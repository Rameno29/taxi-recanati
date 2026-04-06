import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import MapPlaceholder from "../components/MapPlaceholder";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
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

  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await ExpoLocation.getCurrentPositionAsync({});
      const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(pos);
      setPickup(pos);
      setPickupAddress("La tua posizione");
    })();
  }, []);

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
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Booking failed");
      }

      const data = await res.json();
      setFareEstimate(data.fareBreakdown?.estimated_fare || data.ride.fare_estimate);

      // Navigate to tracking
      const parent = navigation.getParent();
      if (parent) {
        parent.navigate("MainTabs", { screen: "Tracking" });
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  };

  const vehicleOptions: { key: VehicleType; label: string }[] = [
    { key: "standard", label: t("home.vehicleStandard") },
    { key: "premium", label: t("home.vehiclePremium") },
    { key: "van", label: t("home.vehicleVan") },
  ];

  return (
    <View style={styles.container}>
      <MapPlaceholder
        style={styles.map}
        onPress={handleMapPress}
        markers={[
          ...(pickup ? [{ ...pickup, color: "green", title: t("home.pickup") }] : []),
          ...(destination ? [{ ...destination, color: "red", title: t("home.destination") }] : []),
        ]}
      />

      <View style={styles.panel}>
        {/* Location indicators */}
        <View style={styles.locationRow}>
          <Ionicons
            name="location"
            size={20}
            color={selectingPoint === "pickup" ? colors.primaryBlue : colors.success}
          />
          <Text
            style={[styles.locationText, selectingPoint === "pickup" && styles.locationTextActive]}
            numberOfLines={1}
          >
            {t("home.pickup")}: {pickupAddress || t("home.whereToGo")}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <Ionicons
            name="flag"
            size={20}
            color={selectingPoint === "destination" ? colors.primaryBlue : colors.accentCoral}
          />
          <Text
            style={[styles.locationText, selectingPoint === "destination" && styles.locationTextActive]}
            numberOfLines={1}
          >
            {t("home.destination")}: {destinationAddress || t("home.whereToGo")}
          </Text>
        </View>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.panel,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: spacing.sm,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: colors.bodyText,
  },
  locationTextActive: {
    color: colors.primaryBlue,
    fontWeight: "600",
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
});
