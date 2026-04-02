import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import type { Ride, Location } from "../types";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Tracking">;

const STATUS_COLORS: Record<string, string> = {
  pending: "#FF9800",
  accepted: "#2196F3",
  arriving: "#9C27B0",
  in_progress: "#4CAF50",
  completed: "#607D8B",
  cancelled: "#F44336",
};

export default function TrackingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);

  const fetchActiveRide = async () => {
    try {
      const res = await api.get("/api/rides/active");
      if (res.ok) {
        const data = await res.json();
        setRide(data);
      } else {
        setRide(null);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchActiveRide();
    }, [])
  );

  // Listen for real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !ride) return;

    const handleStatusChange = (data: { rideId: string; newStatus: string }) => {
      if (data.rideId === ride.id) {
        setRide((prev) => (prev ? { ...prev, status: data.newStatus as any } : null));
      }
    };

    const handleDriverLocation = (data: { lat: number; lng: number }) => {
      setDriverLocation({ latitude: data.lat, longitude: data.lng });
    };

    socket.on("ride:status_changed", handleStatusChange);
    socket.on("driver:location", handleDriverLocation);

    return () => {
      socket.off("ride:status_changed", handleStatusChange);
      socket.off("driver:location", handleDriverLocation);
    };
  }, [ride?.id]);

  const handleCancel = () => {
    if (!ride) return;
    Alert.alert(t("ride.cancelRide"), t("ride.cancelConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.patch(`/api/rides/${ride.id}/status`, {
              status: "cancelled",
              cancellation_reason: "Customer cancelled",
            });
            fetchActiveRide();
          } catch (err: any) {
            Alert.alert(t("common.error"), err.message);
          }
        },
      },
    ]);
  };

  const handleRate = async () => {
    if (!ride || rating === 0) return;
    try {
      await api.post(`/api/rides/${ride.id}/rate`, { rating });
      Alert.alert(t("common.ok"), t("ride.rateRide"));
      fetchActiveRide();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    }
  };

  const openChat = () => {
    if (!ride) return;
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("Chat", { rideId: ride.id });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>{t("common.loading")}</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <ScrollView
        contentContainerStyle={styles.center}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchActiveRide} />
        }
      >
        <Text style={styles.emptyText}>{t("ride.noActiveRide")}</Text>
      </ScrollView>
    );
  }

  const canCancel = ["pending", "accepted", "arriving"].includes(ride.status);
  const isCompleted = ride.status === "completed";
  const showMap = ["accepted", "arriving", "in_progress"].includes(ride.status);

  return (
    <View style={styles.container}>
      {showMap && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: ride.pickup_lat,
            longitude: ride.pickup_lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          showsUserLocation
        >
          <Marker
            coordinate={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }}
            pinColor="green"
            title={t("home.pickup")}
          />
          <Marker
            coordinate={{ latitude: ride.destination_lat, longitude: ride.destination_lng }}
            pinColor="red"
            title={t("home.destination")}
          />
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              pinColor="blue"
              title={t("ride.driver")}
            />
          )}
        </MapView>
      )}

      <View style={styles.infoPanel}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ride.status] || "#999" }]}>
          <Text style={styles.statusText}>
            {t(`ride.${ride.status}` as any)}
          </Text>
        </View>

        {ride.driver_name && (
          <Text style={styles.driverInfo}>
            {t("ride.driver")}: {ride.driver_name}
            {ride.license_plate ? ` • ${ride.license_plate}` : ""}
          </Text>
        )}

        <Text style={styles.fareText}>
          {t("ride.fare")}: €{(ride.fare_final || ride.fare_estimate).toFixed(2)}
        </Text>

        <View style={styles.actions}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>{t("ride.cancelRide")}</Text>
            </TouchableOpacity>
          )}

          {ride.driver_id && !isCompleted && (
            <TouchableOpacity style={styles.chatBtn} onPress={openChat}>
              <Text style={styles.chatBtnText}>{t("ride.chat")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isCompleted && !ride.customer_rating && (
          <View style={styles.ratingSection}>
            <Text style={styles.ratingPrompt}>{t("ride.ratePrompt")}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text style={[styles.star, star <= rating && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <TouchableOpacity style={styles.submitBtn} onPress={handleRate}>
                <Text style={styles.submitBtnText}>{t("ride.submit")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
  map: { flex: 1 },
  infoPanel: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  driverInfo: { fontSize: 16, color: "#333", marginBottom: 8 },
  fareText: { fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 12 },
  actions: { flexDirection: "row", gap: 12, marginBottom: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F44336",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  chatBtn: {
    flex: 1,
    backgroundColor: "#2196F3",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  chatBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  ratingSection: { marginTop: 12, alignItems: "center" },
  ratingPrompt: { fontSize: 16, color: "#333", marginBottom: 8 },
  stars: { flexDirection: "row", gap: 8 },
  star: { fontSize: 36, color: "#ddd" },
  starActive: { color: "#FFC107" },
  submitBtn: {
    backgroundColor: "#FFC107",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  submitBtnText: { fontWeight: "bold", fontSize: 16 },
});
