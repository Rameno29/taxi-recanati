import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import PaymentSheet from "../components/PaymentSheet";
import AddressSearch from "../components/AddressSearch";
import type { AddressSuggestion } from "../components/AddressSearch";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { fetchRoute } from "../services/routing";
import { colors, spacing, radii, shadows } from "../theme";
import type { Location } from "../types";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;

// Recanati center
const RECANATI = {
  latitude: 43.4034,
  longitude: 13.5498,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type VehicleType = "standard" | "premium" | "van";
type RideType = "immediate" | "reservation";

const VEHICLE_ICONS: Record<VehicleType, keyof typeof Ionicons.glyphMap> = {
  standard: "car-outline",
  premium: "car-sport-outline",
  van: "bus-outline",
};

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [pickup, setPickup] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [rideType, setRideType] = useState<RideType>("immediate");
  const [fareEstimate, setFareEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectingPoint, setSelectingPoint] = useState<"pickup" | "destination">("pickup");
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date(Date.now() + 3600000)); // 1h from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ km: string; min: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await ExpoLocation.getCurrentPositionAsync({});
      const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(pos);
      setPickup(pos);
      setPickupAddress(t("home.yourLocation"));
    })();
  }, []);

  // Fetch driving route when both pickup and destination are set
  useEffect(() => {
    if (!pickup || !destination) {
      setRouteCoords([]);
      setRouteInfo(null);
      return;
    }

    let cancelled = false;
    fetchRoute(
      pickup.latitude, pickup.longitude,
      destination.latitude, destination.longitude
    ).then((result) => {
      if (cancelled) return;
      if (result) {
        setRouteCoords(result.coordinates);
        setRouteInfo({
          km: (result.distanceMeters / 1000).toFixed(1),
          min: Math.round(result.durationSeconds / 60).toString(),
        });
      }
    });

    return () => { cancelled = true; };
  }, [pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude]);

  const handleMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (selectingPoint === "pickup") {
      setPickup(coord);
      setPickupAddress(`${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`);
      setSelectingPoint("destination");
    } else {
      setDestination(coord);
      setDestinationAddress(`${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`);
    }
    setFareEstimate(null);
  };

  const handlePickupSelect = (suggestion: AddressSuggestion) => {
    const coord = {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    };
    setPickup(coord);
    setSelectingPoint("destination");
    setFareEstimate(null);
  };

  const handleDestinationSelect = (suggestion: AddressSuggestion) => {
    const coord = {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    };
    setDestination(coord);
    setFareEstimate(null);
    Keyboard.dismiss();
  };

  const navigateToTracking = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("MainTabs", { screen: "Tracking" });
    }
  };

  const handleBookRide = async () => {
    if (!pickup || !destination) {
      Alert.alert(t("common.error"), t("home.whereToGo"));
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/api/rides", {
        pickup_lat: pickup.latitude,
        pickup_lng: pickup.longitude,
        pickup_address: pickupAddress,
        destination_lat: destination.latitude,
        destination_lng: destination.longitude,
        destination_address: destinationAddress,
        type: rideType,
        vehicle_type: vehicleType,
        ...(rideType === "reservation" ? { scheduled_at: scheduledDate.toISOString() } : {}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Booking failed");
      }

      const data = await res.json();
      const fare = data.fareBreakdown?.estimated_fare || data.ride.fare_estimate;
      setFareEstimate(fare);

      const rideId = data.ride?.id || data.id;

      // Skip payment in dev mode (Stripe requires native modules / EAS build)
      // In production, this will trigger the PaymentSheet
      if (__DEV__) {
        navigateToTracking();
      } else if (fare && Number(fare) > 0) {
        setPendingRideId(rideId);
        setShowPayment(true);
      } else {
        navigateToTracking();
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setPendingRideId(null);
    navigateToTracking();
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    // Ride is created but payment was cancelled — still navigate to tracking
    // The user can pay later or the ride can be cancelled
    Alert.alert(
      t("payment.cancelledTitle", "Pagamento annullato"),
      t("payment.cancelledMessage", "Puoi completare il pagamento in seguito."),
      [
        {
          text: t("common.ok", "OK"),
          onPress: navigateToTracking,
        },
      ]
    );
  };

  const vehicleOptions: { key: VehicleType; label: string }[] = [
    { key: "standard", label: t("home.vehicleStandard") },
    { key: "premium", label: t("home.vehiclePremium") },
    { key: "van", label: t("home.vehicleVan") },
  ];

  return (
    <View style={styles.container}>
      <LiveMap
        style={styles.map}
        initialRegion={RECANATI}
        showUserLocation
        onPress={handleMapPress}
        routeCoordinates={routeCoords}
        markers={[
          ...(pickup
            ? [{ coordinate: pickup, color: "green", title: t("home.pickup") }]
            : []),
          ...(destination
            ? [{ coordinate: destination, color: "red", title: t("home.destination") }]
            : []),
        ]}
      />

      {/* Address search overlay — sits on top of the map so keyboard doesn't cover it */}
      <View style={[styles.searchOverlay, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <View style={styles.searchCard}>
          <View style={{ zIndex: 20 }}>
            <AddressSearch
              placeholder={t("home.pickup")}
              value={pickupAddress}
              onChangeText={setPickupAddress}
              onSelect={handlePickupSelect}
              icon="location"
              iconColor={colors.success}
              clearOnFocus
            />
          </View>
          <View style={{ zIndex: 10, marginTop: spacing.sm }}>
            <AddressSearch
              placeholder={t("home.destination")}
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              onSelect={handleDestinationSelect}
              icon="flag"
              iconColor={colors.accentCoral}
              autoFocus={false}
            />
          </View>
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {/* Route info badge */}
        {routeInfo && (
          <View style={styles.routeInfoRow}>
            <View style={styles.routeInfoBadge}>
              <Ionicons name="navigate" size={14} color={colors.primaryBlue} />
              <Text style={styles.routeInfoText}>{routeInfo.km} km</Text>
            </View>
            <View style={styles.routeInfoBadge}>
              <Ionicons name="time" size={14} color={colors.primaryBlue} />
              <Text style={styles.routeInfoText}>~{routeInfo.min} min</Text>
            </View>
          </View>
        )}

        {/* Vehicle type selector */}
        <View style={styles.vehicleRow}>
          {vehicleOptions.map((v) => (
            <TouchableOpacity
              key={v.key}
              style={[styles.vehicleBtn, vehicleType === v.key && styles.vehicleBtnActive]}
              onPress={() => setVehicleType(v.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={VEHICLE_ICONS[v.key]}
                size={22}
                color={vehicleType === v.key ? colors.white : colors.bodyText}
              />
              <Text style={[styles.vehicleText, vehicleType === v.key && styles.vehicleTextActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ride type selector */}
        <View style={styles.vehicleRow}>
          <TouchableOpacity
            style={[styles.rideTypeBtn, rideType === "immediate" && styles.rideTypeBtnActive]}
            onPress={() => setRideType("immediate")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flash-outline"
              size={18}
              color={rideType === "immediate" ? colors.primaryBlue : colors.bodyText}
            />
            <Text style={[styles.rideTypeText, rideType === "immediate" && styles.rideTypeTextActive]}>
              {t("home.immediate")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rideTypeBtn, rideType === "reservation" && styles.rideTypeBtnActive]}
            onPress={() => setRideType("reservation")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={rideType === "reservation" ? colors.primaryBlue : colors.bodyText}
            />
            <Text style={[styles.rideTypeText, rideType === "reservation" && styles.rideTypeTextActive]}>
              {t("home.reservation")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date/time picker for reservations */}
        {rideType === "reservation" && (
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={styles.dateTimeBtn}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar" size={16} color={colors.primaryBlue} />
              <Text style={styles.dateTimeText}>
                {scheduledDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateTimeBtn}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="time" size={16} color={colors.primaryBlue} />
              <Text style={styles.dateTimeText}>
                {scheduledDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(showDatePicker || showTimePicker) && (
          <DateTimePicker
            value={scheduledDate}
            mode={showDatePicker ? "date" : "time"}
            is24Hour
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              setShowTimePicker(false);
              if (date && event.type !== "dismissed") {
                setScheduledDate(date);
                // On Android, show time picker right after date picker
                if (showDatePicker && Platform.OS === "android") {
                  setTimeout(() => setShowTimePicker(true), 300);
                }
              }
            }}
          />
        )}

        {fareEstimate !== null && (
          <Text style={styles.fare}>
            {t("home.estimatedFare")}: €{Number(fareEstimate).toFixed(2)}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.bookButton, (loading || !pickup || !destination) && styles.bookButtonDisabled]}
          onPress={handleBookRide}
          disabled={loading || !pickup || !destination}
          activeOpacity={0.8}
        >
          <Ionicons name="car" size={20} color={colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.bookButtonText}>
            {loading ? t("common.loading") : t("home.bookRide")}
          </Text>
        </TouchableOpacity>

        {showPayment && pendingRideId && (
          <PaymentSheet
            rideId={pendingRideId}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    // paddingTop set dynamically via useSafeAreaInsets()
    paddingHorizontal: spacing.md,
  },
  searchCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    ...shadows.card,
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.panel,
  },
  vehicleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  vehicleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
  },
  vehicleBtnActive: {
    backgroundColor: colors.primaryBlue,
    borderColor: colors.primaryBlue,
  },
  vehicleText: { fontSize: 12, color: colors.bodyText, fontWeight: "500" },
  vehicleTextActive: { color: colors.white, fontWeight: "bold" },
  rideTypeBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rideTypeBtnActive: {
    borderColor: colors.primaryBlue,
    backgroundColor: colors.primaryBlue + "10",
  },
  rideTypeText: { fontSize: 14, color: colors.bodyText },
  rideTypeTextActive: { color: colors.primaryBlue, fontWeight: "600" },
  fare: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: spacing.sm,
    color: colors.dark,
  },
  bookButton: {
    backgroundColor: colors.accentCoral,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
    shadowColor: colors.accentCoral,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonDisabled: { opacity: 0.5 },
  bookButtonText: { fontSize: 18, fontWeight: "bold", color: colors.white },
  dateTimeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryBlue + "10",
    borderWidth: 1.5,
    borderColor: colors.primaryBlue + "30",
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryBlue,
  },
  routeInfoRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  routeInfoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryBlue + "12",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryBlue,
  },
});
