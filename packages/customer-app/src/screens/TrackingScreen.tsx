import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import LiveMap from "../components/LiveMap";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { colors, spacing, radii, shadows } from "../theme";
import type { Ride, Location } from "../types";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Tracking">;

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  accepted: colors.primaryBlue,
  arriving: "#9C27B0",
  in_progress: colors.success,
  completed: "#607D8B",
  cancelled: colors.error,
};

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: "time-outline",
  accepted: "checkmark-circle-outline",
  arriving: "navigate-outline",
  in_progress: "car-outline",
  completed: "checkmark-done-outline",
  cancelled: "close-circle-outline",
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
        <ActivityIndicator size="large" color={colors.primaryBlue} />
        <Text style={styles.loadingText}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <ScrollView
        contentContainerStyle={styles.center}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchActiveRide} tintColor={colors.primaryBlue} />
        }
      >
        <Ionicons name="car-outline" size={64} color={colors.border} />
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
        <LiveMap
          style={styles.map}
          markers={[
            {
              coordinate: { latitude: Number(ride.pickup_lat), longitude: Number(ride.pickup_lng) },
              color: "green",
              title: t("home.pickup"),
            },
            {
              coordinate: { latitude: Number(ride.destination_lat), longitude: Number(ride.destination_lng) },
              color: "red",
              title: t("home.destination"),
            },
          ]}
          driverLocation={driverLocation}
        />
      )}

      <View style={styles.infoPanel}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ride.status] || "#999" }]}>
          <Ionicons
            name={STATUS_ICONS[ride.status] || "help-circle-outline"}
            size={16}
            color={colors.white}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.statusText}>
            {t(`ride.${ride.status}` as any)}
          </Text>
        </View>

        {ride.driver_name && (
          <View style={styles.driverRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.primaryBlue} />
            <Text style={styles.driverInfo}>
              {ride.driver_name}
              {ride.license_plate ? ` · ${ride.license_plate}` : ""}
            </Text>
          </View>
        )}

        <Text style={styles.fareText}>
          {t("ride.fare")}: €{Number(ride.fare_final || ride.fare_estimate).toFixed(2)}
        </Text>

        <View style={styles.actions}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Ionicons name="close-circle-outline" size={20} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.cancelBtnText}>{t("ride.cancelRide")}</Text>
            </TouchableOpacity>
          )}

          {ride.driver_id && !isCompleted && (
            <TouchableOpacity style={styles.chatBtn} onPress={openChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.white} style={{ marginRight: 6 }} />
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
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={36}
                    color={star <= rating ? colors.accentCoral : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <TouchableOpacity style={styles.submitBtn} onPress={handleRate} activeOpacity={0.8}>
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
  container: { flex: 1, backgroundColor: colors.lightBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.lightBg, gap: spacing.md },
  loadingText: { fontSize: 16, color: colors.bodyText, marginTop: spacing.sm },
  emptyText: { fontSize: 16, color: colors.bodyText },
  map: { flex: 1 },
  infoPanel: {
    backgroundColor: colors.white,
    padding: 20,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.panel,
  },
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginBottom: spacing.md,
  },
  statusText: { color: colors.white, fontWeight: "bold", fontSize: 14 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  driverInfo: { fontSize: 16, color: colors.dark, fontWeight: "500" },
  fareText: { fontSize: 20, fontWeight: "bold", color: colors.dark, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.error,
    padding: 14,
    borderRadius: radii.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  cancelBtnText: { color: colors.white, fontWeight: "bold", fontSize: 16 },
  chatBtn: {
    flex: 1,
    backgroundColor: colors.primaryBlue,
    padding: 14,
    borderRadius: radii.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  chatBtnText: { color: colors.white, fontWeight: "bold", fontSize: 16 },
  ratingSection: { marginTop: spacing.md, alignItems: "center" },
  ratingPrompt: { fontSize: 16, color: colors.dark, marginBottom: spacing.sm, fontWeight: "500" },
  stars: { flexDirection: "row", gap: spacing.sm },
  submitBtn: {
    backgroundColor: colors.primaryBlue,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  submitBtnText: { fontWeight: "bold", fontSize: 16, color: colors.white },
});
