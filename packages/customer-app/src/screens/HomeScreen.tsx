import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import LiveMap from "../components/LiveMap";
import PaymentSheet from "../components/PaymentSheet";
import AddressSearch from "../components/AddressSearch";
import type { AddressSuggestion } from "../components/AddressSearch";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import { fetchRoute } from "../services/routing";
import { colors as staticColors, spacing, radii, shadows } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { Location } from "../types";
import {
  getSavedPlaces,
  addSavedPlace,
  removeSavedPlace,
  suggestIcon,
  type SavedPlace,
} from "../services/savedPlaces";
import {
  listPaymentMethods,
  formatMethodLabel,
  iconForMethod,
  type SavedPaymentMethod,
} from "../services/paymentMethods";
import PaymentMethodsScreen from "./PaymentMethodsScreen";
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
  const colors = useThemeColors();
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [pickup, setPickup] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("standard");
  const [rideType, setRideType] = useState<RideType>("immediate");
  const [loading, setLoading] = useState(false);
  const [selectingPoint, setSelectingPoint] = useState<"pickup" | "destination">("pickup");
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date(Date.now() + 3600000)); // 1h from now
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<
    { lat: number; lng: number; vehicle_type: string }[]
  >([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [showSavePlace, setShowSavePlace] = useState(false);
  const [savePlaceLabel, setSavePlaceLabel] = useState("");
  // Payment method selected for the next ride. null = default (or ad-hoc).
  const [selectedMethod, setSelectedMethod] =
    useState<SavedPaymentMethod | null>(null);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ km: string; min: string } | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateData, setEstimateData] = useState<{
    isFixed: boolean;
    fixedRouteName?: string;
    minPrice?: number;
    maxPrice?: number;
    estimatedFare?: number;
    breakdown?: { base: number; distance: number; time: number; night: number };
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });
      const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(pos);
      setPickup(pos);
      setPickupAddress(t("home.yourLocation"));
    })();
  }, []);

  // Load saved places on mount + refresh on focus (covers add/delete from
  // anywhere in the app).
  const reloadSavedPlaces = useCallback(async () => {
    const list = await getSavedPlaces();
    setSavedPlaces(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSavedPlaces();
    }, [reloadSavedPlaces])
  );

  // Keep the currently-selected payment method in sync with the server's
  // default. Runs on focus so that changes made in the PaymentMethods screen
  // are reflected immediately when returning here.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const methods = await listPaymentMethods();
          // If the user already picked a method and it still exists, keep it.
          if (selectedMethod) {
            const stillThere = methods.find((m) => m.id === selectedMethod.id);
            if (stillThere) {
              setSelectedMethod(stillThere);
              return;
            }
          }
          const def = methods.find((m) => m.is_default) || null;
          setSelectedMethod(def);
        } catch {
          // Not authenticated yet or no Stripe config — silently ignore.
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Poll nearby available drivers every 15s while the user is on Home and
  // hasn't kicked off a booking yet. Filtered to only `available` drivers
  // server-side, no PII in the payload.
  useEffect(() => {
    let cancelled = false;

    const fetchNearby = async () => {
      try {
        const res = await api.get("/api/drivers/active-positions");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setNearbyDrivers(data);
      } catch {
        // Silently ignore — this is best-effort UI, not critical.
      }
    };

    fetchNearby();
    const interval = setInterval(fetchNearby, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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

  // Fetch fare estimate when pickup + destination + vehicleType are set
  useEffect(() => {
    if (!pickup || !destination) {
      setEstimateData(null);
      return;
    }

    let cancelled = false;
    setEstimateLoading(true);

    api.post("/api/rides/estimate", {
      pickup_lat: pickup.latitude,
      pickup_lng: pickup.longitude,
      destination_lat: destination.latitude,
      destination_lng: destination.longitude,
      vehicle_type: vehicleType,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setEstimateData(null);
          return;
        }
        const data = await res.json();
        if (data.is_fixed_route) {
          setEstimateData({
            isFixed: true,
            fixedRouteName: data.fixed_route_name,
            minPrice: data.min_price,
            maxPrice: data.max_price,
          });
        } else {
          setEstimateData({
            isFixed: false,
            estimatedFare: data.estimated_fare,
            breakdown: {
              base: data.base_fare,
              distance: data.distance_charge,
              time: data.time_charge,
              night: data.night_surcharge,
            },
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEstimateData(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateLoading(false);
      });

    return () => { cancelled = true; };
  }, [pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude, vehicleType]);

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
  };

  const handlePickupSelect = (suggestion: AddressSuggestion) => {
    const coord = {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    };
    setPickup(coord);
    setSelectingPoint("destination");
  };

  const handleDestinationSelect = (suggestion: AddressSuggestion) => {
    const coord = {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    };
    setDestination(coord);
    Keyboard.dismiss();
  };

  const handleSelectCurrentAsPickup = () => {
    if (!userLocation) {
      Alert.alert(t("common.error"), "Posizione non ancora disponibile");
      return;
    }
    setPickup(userLocation);
    setPickupAddress(t("home.yourLocation"));
    setSelectingPoint("destination");
  };

  const handlePickupSavedPlace = (p: SavedPlace) => {
    setPickup({ latitude: p.lat, longitude: p.lng });
    setPickupAddress(p.address);
    setSelectingPoint("destination");
  };

  const handleDestinationSavedPlace = (p: SavedPlace) => {
    setDestination({ latitude: p.lat, longitude: p.lng });
    setDestinationAddress(p.address);
    Keyboard.dismiss();
  };

  const handleLongPressSavedPlace = (p: SavedPlace) => {
    Alert.alert(
      p.label,
      p.address,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("home.deletePlace"),
          style: "destructive",
          onPress: async () => {
            await removeSavedPlace(p.id);
            await reloadSavedPlaces();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const openSavePlaceModal = () => {
    if (!destination || !destinationAddress) {
      Alert.alert(t("common.error"), t("home.whereToGo"));
      return;
    }
    setSavePlaceLabel("");
    setShowSavePlace(true);
  };

  const confirmSavePlace = async () => {
    const label = savePlaceLabel.trim();
    if (!label || !destination) return;
    await addSavedPlace({
      label,
      address: destinationAddress,
      lat: destination.latitude,
      lng: destination.longitude,
      icon: suggestIcon(label),
    });
    setShowSavePlace(false);
    await reloadSavedPlaces();
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
      const rideId = data.ride?.id || data.id;
      const fare = data.fareBreakdown?.estimated_fare || data.ride?.fare_estimate;

      // Rides are now created in `payment_pending` status. The server will
      // only dispatch the ride once payment is authorized and we call
      // /activate. If the ride has no fare (free?) or Stripe isn't wired in
      // Expo Go, we activate immediately to keep the flow working.
      if (fare && Number(fare) > 0) {
        setPendingRideId(rideId);
        setShowPayment(true);
      } else {
        await activateRideAndNavigate(rideId);
      }
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Flip the ride from payment_pending → pending server-side, then navigate.
   * Defensive — if the webhook already activated it the server will return
   * the row as-is (idempotent).
   */
  const activateRideAndNavigate = async (rideId: string) => {
    try {
      await api.post(`/api/rides/${rideId}/activate`, {});
    } catch {
      // Webhook may have already activated — navigate regardless. The
      // tracking screen will reflect whatever state the server is in.
    }
    navigateToTracking();
  };

  const handlePaymentSuccess = async () => {
    const rideId = pendingRideId;
    setShowPayment(false);
    setPendingRideId(null);
    if (rideId) {
      await activateRideAndNavigate(rideId);
    } else {
      navigateToTracking();
    }
  };

  const handlePaymentCancel = async () => {
    const rideId = pendingRideId;
    setShowPayment(false);
    setPendingRideId(null);

    // Cancel the ride server-side so it doesn't sit in payment_pending and
    // so the PaymentIntent hold (if any) is released on the same method.
    if (rideId) {
      try {
        await api.patch(`/api/rides/${rideId}/status`, {
          status: "cancelled",
          cancellation_reason: "payment_cancelled_by_user",
        });
      } catch {
        // Best-effort — server will eventually expire it anyway.
      }
    }

    Alert.alert(
      t("payment.cancelledTitle", "Pagamento annullato"),
      t("payment.cancelledMessage", "La corsa è stata annullata.")
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
        centerOnFirstFix={userLocation}
        onPress={handleMapPress}
        routeCoordinates={routeCoords}
        nearbyDrivers={pendingRideId ? [] : nearbyDrivers}
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
        <View style={[styles.searchCard, { backgroundColor: colors.white }]}>
          <View style={{ zIndex: 20 }}>
            <AddressSearch
              placeholder={t("home.pickup")}
              value={pickupAddress}
              onChangeText={setPickupAddress}
              onSelect={handlePickupSelect}
              icon="location"
              iconColor={colors.success}
              clearOnFocus
              showCurrentLocation={!!userLocation}
              currentLocationLabel={t("home.yourLocation")}
              onSelectCurrentLocation={handleSelectCurrentAsPickup}
              savedPlaces={savedPlaces}
              onSelectSavedPlace={handlePickupSavedPlace}
              onLongPressSavedPlace={handleLongPressSavedPlace}
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
              savedPlaces={savedPlaces}
              onSelectSavedPlace={handleDestinationSavedPlace}
              onLongPressSavedPlace={handleLongPressSavedPlace}
            />
            {destination && destinationAddress.length > 0 && (
              <TouchableOpacity
                style={[styles.savePlaceLink, { borderColor: colors.border }]}
                onPress={openSavePlaceModal}
                activeOpacity={0.7}
              >
                <Ionicons name="bookmark-outline" size={14} color={colors.primaryBlue} />
                <Text style={[styles.savePlaceLinkText, { color: colors.primaryBlue }]}>
                  {t("home.saveDestination")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.md), backgroundColor: colors.white }]}>
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
              style={[
                styles.vehicleBtn,
                { borderColor: colors.border },
                vehicleType === v.key && styles.vehicleBtnActive,
              ]}
              onPress={() => setVehicleType(v.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={VEHICLE_ICONS[v.key]}
                size={22}
                color={vehicleType === v.key ? "#FFF" : colors.bodyText}
              />
              <Text
                style={[
                  styles.vehicleText,
                  { color: colors.bodyText },
                  vehicleType === v.key && styles.vehicleTextActive,
                ]}
              >
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ride type selector */}
        <View style={styles.vehicleRow}>
          <TouchableOpacity
            style={[
              styles.rideTypeBtn,
              { borderColor: colors.border },
              rideType === "immediate" && styles.rideTypeBtnActive,
            ]}
            onPress={() => setRideType("immediate")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flash-outline"
              size={18}
              color={rideType === "immediate" ? colors.primaryBlue : colors.bodyText}
            />
            <Text
              style={[
                styles.rideTypeText,
                { color: colors.bodyText },
                rideType === "immediate" && styles.rideTypeTextActive,
              ]}
            >
              {t("home.immediate")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.rideTypeBtn,
              { borderColor: colors.border },
              rideType === "reservation" && styles.rideTypeBtnActive,
            ]}
            onPress={() => setRideType("reservation")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={rideType === "reservation" ? colors.primaryBlue : colors.bodyText}
            />
            <Text
              style={[
                styles.rideTypeText,
                { color: colors.bodyText },
                rideType === "reservation" && styles.rideTypeTextActive,
              ]}
            >
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

        {/* Fare estimate preview */}
        {estimateLoading && pickup && destination && (
          <View style={styles.estimateCard}>
            <Text style={[styles.estimateLoading, { color: colors.bodyText }]}>
              {t("home.calculatingFare", "Calcolo tariffa...")}
            </Text>
          </View>
        )}
        {estimateData && !estimateLoading && (
          <View style={styles.estimateCard}>
            {estimateData.isFixed ? (
              <>
                <Text style={[styles.estimateLabel, { color: colors.bodyText }]}>
                  {estimateData.fixedRouteName}
                </Text>
                <Text style={styles.estimatePrice}>
                  €{estimateData.minPrice?.toFixed(2)} – €{estimateData.maxPrice?.toFixed(2)}
                </Text>
              </>
            ) : (
              <>
                <View style={styles.estimateBreakdown}>
                  <View style={styles.estimateBreakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.bodyText }]}>
                      {t("home.fareBase", "Base")}
                    </Text>
                    <Text style={[styles.breakdownValue, { color: colors.bodyText }]}>
                      €{estimateData.breakdown?.base.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.estimateBreakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.bodyText }]}>
                      {t("home.fareDistance", "Distanza")}
                    </Text>
                    <Text style={[styles.breakdownValue, { color: colors.bodyText }]}>
                      €{estimateData.breakdown?.distance.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.estimateBreakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: colors.bodyText }]}>
                      {t("home.fareTime", "Tempo")}
                    </Text>
                    <Text style={[styles.breakdownValue, { color: colors.bodyText }]}>
                      €{estimateData.breakdown?.time.toFixed(2)}
                    </Text>
                  </View>
                  {(estimateData.breakdown?.night ?? 0) > 0 && (
                    <View style={styles.estimateBreakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.bodyText }]}>
                        {t("home.fareNight", "Notturno")}
                      </Text>
                      <Text style={[styles.breakdownValue, { color: colors.bodyText }]}>
                        €{estimateData.breakdown?.night.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.estimateTotalRow}>
                  <Text style={[styles.estimateTotalLabel, { color: colors.dark }]}>
                    {t("home.estimatedFare", "Tariffa stimata")}
                  </Text>
                  <Text style={styles.estimatePrice}>€{estimateData.estimatedFare?.toFixed(2)}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Payment method selector — tappable row showing current choice. */}
        <TouchableOpacity
          style={[
            styles.methodSelector,
            {
              backgroundColor: colors.white,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowMethodPicker(true)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.methodBubble,
              { backgroundColor: colors.lightBg },
            ]}
          >
            <Ionicons
              name={
                (selectedMethod
                  ? iconForMethod(selectedMethod)
                  : "card-outline") as any
              }
              size={20}
              color={colors.primaryBlue}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodLabel, { color: colors.bodyText }]}>
              {t("payment.methods.title", "Metodo di pagamento")}
            </Text>
            <Text style={[styles.methodValue, { color: colors.dark }]}>
              {selectedMethod
                ? formatMethodLabel(selectedMethod)
                : t("payment.methods.payWithoutSaving", "Scegli al momento")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bookButton, (loading || !pickup || !destination) && styles.bookButtonDisabled]}
          onPress={handleBookRide}
          disabled={loading || !pickup || !destination}
          activeOpacity={0.8}
        >
          <Ionicons name="car" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.bookButtonText}>
            {loading
              ? t("common.loading")
              : estimateData && !estimateData.isFixed
                ? `${t("home.bookRide")} · €${estimateData.estimatedFare?.toFixed(2)}`
                : t("home.bookRide")}
          </Text>
        </TouchableOpacity>

        {showPayment && pendingRideId && (
          <PaymentSheet
            rideId={pendingRideId}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
            savedPaymentMethodId={selectedMethod?.id}
          />
        )}
      </View>

      {/* Payment method picker modal */}
      <Modal
        visible={showMethodPicker}
        animationType="slide"
        onRequestClose={() => setShowMethodPicker(false)}
      >
        <View style={[styles.pickerHeader, { backgroundColor: colors.primaryBlue }]}>
          <TouchableOpacity
            onPress={() => setShowMethodPicker(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>
            {t("payment.methods.title", "Metodo di pagamento")}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <PaymentMethodsScreen
          onPick={(m) => {
            setSelectedMethod(m);
            setShowMethodPicker(false);
          }}
          allowAdHoc
          onPickAdHoc={() => {
            setSelectedMethod(null);
            setShowMethodPicker(false);
          }}
        />
      </Modal>

      {/* Save place modal */}
      <Modal
        visible={showSavePlace}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSavePlace(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.white }]}>
            <Text style={[styles.modalTitle, { color: colors.dark }]}>
              {t("home.savePlaceTitle")}
            </Text>
            <Text style={[styles.modalAddress, { color: colors.bodyText }]} numberOfLines={2}>
              {destinationAddress}
            </Text>
            <Text style={[styles.modalLabel, { color: colors.bodyText }]}>
              {t("home.savePlaceLabel")}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.dark,
                  borderColor: colors.border,
                },
              ]}
              placeholder={t("home.savePlacePlaceholder")}
              placeholderTextColor={colors.bodyText + "88"}
              value={savePlaceLabel}
              onChangeText={setSavePlaceLabel}
              autoFocus
              maxLength={32}
              returnKeyType="done"
              onSubmitEditing={confirmSavePlace}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowSavePlace(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.bodyText }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  !savePlaceLabel.trim() && { opacity: 0.5 },
                ]}
                onPress={confirmSavePlace}
                disabled={!savePlaceLabel.trim()}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: "#FFF" }]}>
                  {t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: spacing.md,
  },
  searchCard: {
    backgroundColor: staticColors.white,
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    ...shadows.card,
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: staticColors.white,
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
    borderColor: staticColors.border,
    alignItems: "center",
    gap: 4,
  },
  vehicleBtnActive: {
    backgroundColor: staticColors.primaryBlue,
    borderColor: staticColors.primaryBlue,
  },
  vehicleText: { fontSize: 12, color: staticColors.bodyText, fontWeight: "500" },
  vehicleTextActive: { color: "#FFF", fontWeight: "bold" },
  rideTypeBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: staticColors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rideTypeBtnActive: {
    borderColor: staticColors.primaryBlue,
    backgroundColor: staticColors.primaryBlue + "10",
  },
  rideTypeText: { fontSize: 14, color: staticColors.bodyText },
  rideTypeTextActive: { color: staticColors.primaryBlue, fontWeight: "600" },
  bookButton: {
    backgroundColor: staticColors.accentCoral,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
    shadowColor: staticColors.accentCoral,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonDisabled: { opacity: 0.5 },
  bookButtonText: { fontSize: 18, fontWeight: "bold", color: "#FFF" },
  methodSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  methodBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: { fontSize: 11, fontWeight: "500" },
  methodValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
  },
  pickerTitle: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
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
    backgroundColor: staticColors.primaryBlue + "10",
    borderWidth: 1.5,
    borderColor: staticColors.primaryBlue + "30",
  },
  dateTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: staticColors.primaryBlue,
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
    backgroundColor: staticColors.primaryBlue + "12",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.full,
  },
  routeInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: staticColors.primaryBlue,
  },
  estimateCard: {
    backgroundColor: staticColors.primaryBlue + "08",
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: staticColors.primaryBlue + "20",
  },
  estimateLoading: {
    fontSize: 13,
    color: staticColors.bodyText,
    textAlign: "center",
    fontWeight: "500",
  },
  estimateLabel: {
    fontSize: 13,
    color: staticColors.bodyText,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  estimateBreakdown: {
    gap: 4,
  },
  estimateBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: staticColors.bodyText,
  },
  breakdownValue: {
    fontSize: 12,
    color: staticColors.bodyText,
    fontWeight: "500",
  },
  estimateTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: staticColors.primaryBlue + "20",
    paddingHorizontal: 4,
  },
  estimateTotalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: staticColors.dark,
  },
  estimatePrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: staticColors.primaryBlue,
    textAlign: "center",
  },
  savePlaceLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  savePlaceLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.panel,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalAddress: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    borderWidth: 1.5,
  },
  modalBtnPrimary: {
    backgroundColor: staticColors.primaryBlue,
    borderColor: staticColors.primaryBlue,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
