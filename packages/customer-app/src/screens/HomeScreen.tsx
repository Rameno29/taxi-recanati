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
import MapPlaceholder from "../components/MapPlaceholder";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import type { Location } from "../types";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;

// Recanati center
const RECANATI: Region = {
  latitude: 43.4034,
  longitude: 13.5498,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type VehicleType = "standard" | "premium" | "van";
type RideType = "immediate" | "reservation";

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
        <Text style={styles.hint}>
          {selectingPoint === "pickup"
            ? `📍 ${t("home.pickup")}: ${pickupAddress || t("home.whereToGo")}`
            : `🏁 ${t("home.destination")}: ${destinationAddress || t("home.whereToGo")}`}
        </Text>

        {/* Vehicle type selector */}
        <View style={styles.vehicleRow}>
          {vehicleOptions.map((v) => (
            <TouchableOpacity
              key={v.key}
              style={[styles.vehicleBtn, vehicleType === v.key && styles.vehicleBtnActive]}
              onPress={() => setVehicleType(v.key)}
            >
              <Text style={[styles.vehicleText, vehicleType === v.key && styles.vehicleTextActive]}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ride type selector */}
        <View style={styles.vehicleRow}>
          <TouchableOpacity
            style={[styles.vehicleBtn, rideType === "immediate" && styles.vehicleBtnActive]}
            onPress={() => setRideType("immediate")}
          >
            <Text style={[styles.vehicleText, rideType === "immediate" && styles.vehicleTextActive]}>
              {t("home.immediate")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.vehicleBtn, rideType === "reservation" && styles.vehicleBtnActive]}
            onPress={() => setRideType("reservation")}
          >
            <Text style={[styles.vehicleText, rideType === "reservation" && styles.vehicleTextActive]}>
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
          style={[styles.bookButton, loading && styles.bookButtonDisabled]}
          onPress={handleBookRide}
          disabled={loading || !pickup || !destination}
        >
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
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  hint: { fontSize: 14, color: "#666", marginBottom: 12 },
  vehicleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  vehicleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  vehicleBtnActive: {
    backgroundColor: "#FFC107",
    borderColor: "#FFC107",
  },
  vehicleText: { fontSize: 14, color: "#666" },
  vehicleTextActive: { color: "#000", fontWeight: "bold" },
  fare: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#333",
  },
  bookButton: {
    backgroundColor: "#FFC107",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  bookButtonDisabled: { opacity: 0.6 },
  bookButtonText: { fontSize: 18, fontWeight: "bold", color: "#000" },
});
