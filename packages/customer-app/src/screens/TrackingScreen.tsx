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
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import { fetchRoute } from "../services/routing";
import { colors as staticColors, spacing, radii, shadows } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import { hapticSuccess, hapticAlert, hapticError } from "../services/feedback";
import type { Ride, Location } from "../types";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Tracking">;

const STATUS_COLORS: Record<string, string> = {
  pending: staticColors.warning,
  accepted: staticColors.primaryBlue,
  arriving: "#9C27B0",
  in_progress: staticColors.success,
  completed: "#607D8B",
  cancelled: staticColors.error,
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
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<string | null>(null);

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

  // Fetch route when ride is loaded
  useEffect(() => {
    if (!ride) { setRouteCoords([]); return; }
    let cancelled = false;
    fetchRoute(
      Number(ride.pickup_lat), Number(ride.pickup_lng),
      Number(ride.destination_lat), Number(ride.destination_lng)
    ).then((result) => {
      if (!cancelled && result) setRouteCoords(result.coordinates);
    });
    return () => { cancelled = true; };
  }, [ride?.id]);

  // Compute ETA from driver location to relevant point
  useEffect(() => {
    if (!ride || !driverLocation) { setEta(null); return; }

    const status = ride.status;
    let targetLat: number;
    let targetLng: number;

    if (status === "accepted" || status === "arriving") {
      // ETA to pickup
      targetLat = Number(ride.pickup_lat);
      targetLng = Number(ride.pickup_lng);
    } else if (status === "in_progress") {
      // ETA to destination
      targetLat = Number(ride.destination_lat);
      targetLng = Number(ride.destination_lng);
    } else {
      setEta(null);
      return;
    }

    let cancelled = false;
    fetchRoute(driverLocation.latitude, driverLocation.longitude, targetLat, targetLng)
      .then((result) => {
        if (cancelled || !result) return;
        const mins = Math.max(1, Math.round(result.durationSeconds / 60));
        setEta(`${mins} min`);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [driverLocation?.latitude, driverLocation?.longitude, ride?.status]);

  // Real-time socket listener — handles ALL ride events
  // Works whether we have an active ride or not
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    const tryConnect = () => {
      const socket = getSocket();
      if (!socket) return false;

      const handleRideStatus = (data: any) => {
        const newStatus = data.new_status || data.newStatus;
        const rideId = data.ride_id || data.rideId;

        if (!ride) {
          // No ride displayed yet — any status event means we should refresh
          fetchActiveRide();
          return;
        }

        if (rideId === ride.id && newStatus) {
          // Animate layout transition
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          // Haptic feedback on status change
          if (newStatus === "accepted" || newStatus === "completed") hapticSuccess();
          else if (newStatus === "arriving" || newStatus === "in_progress") hapticAlert();
          else if (newStatus === "cancelled" || newStatus === "no_show") hapticError();

          if (["completed", "cancelled", "expired", "no_show"].includes(newStatus)) {
            fetchActiveRide(); // re-fetch full final state
          } else {
            // Live update the status + driver info without full refetch
            setRide((prev) => prev ? {
              ...prev,
              status: newStatus as any,
              driver_id: data.driver_id || prev.driver_id,
              driver_name: data.driver_name || prev.driver_name,
            } : null);
            // Also do a full re-fetch to get complete driver info
            fetchActiveRide();
          }
        }
      };

      const handleDriverLocation = (data: { lat: number; lng: number }) => {
        setDriverLocation({ latitude: data.lat, longitude: data.lng });
      };

      socket.on("ride:status", handleRideStatus);
      socket.on("driver:location", handleDriverLocation);

      cleanupFn = () => {
        socket.off("ride:status", handleRideStatus);
        socket.off("driver:location", handleDriverLocation);
      };

      return true;
    };

    if (!tryConnect()) {
      retryInterval = setInterval(() => {
        if (tryConnect() && retryInterval) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
      }, 1500);
    }

    return () => {
      cleanupFn?.();
      if (retryInterval) clearInterval(retryInterval);
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
      <View style={[styles.center, { backgroundColor: colors.lightBg }]}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
        <Text style={[styles.loadingText, { color: colors.bodyText }]}>{t("common.loading")}</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <ScrollView
        style={{ backgroundColor: colors.lightBg }}
        contentContainerStyle={[styles.center, { backgroundColor: colors.lightBg }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchActiveRide} tintColor={colors.primaryBlue} />
        }
      >
        <Ionicons name="car-outline" size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.bodyText }]}>{t("ride.noActiveRide")}</Text>
      </ScrollView>
    );
  }

  const canCancel = ["pending", "accepted", "arriving"].includes(ride.status);
  const isCompleted = ride.status === "completed";
  const showMap = ["accepted", "arriving", "in_progress"].includes(ride.status);

  return (
    <View style={[styles.container, { backgroundColor: colors.lightBg }]}>
      {showMap && (
        <LiveMap
          style={styles.map}
          routeCoordinates={routeCoords}
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

      <View style={[styles.infoPanel, { paddingBottom: Math.max(insets.bottom + 10, 20), backgroundColor: colors.white }]}>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[ride.status] || "#999" }]}>
          <Ionicons
            name={STATUS_ICONS[ride.status] || "help-circle-outline"}
            size={16}
            color="#FFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.statusText}>
            {t(`ride.${ride.status}` as any)}
          </Text>
        </View>

        {ride.driver_name && (
          <View style={styles.driverRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.primaryBlue} />
            <Text style={[styles.driverInfo, { color: colors.dark }]}>
              {ride.driver_name}
              {ride.license_plate ? ` · ${ride.license_plate}` : ""}
            </Text>
          </View>
        )}

        {eta && (
          <View style={styles.etaBadge}>
            <Ionicons name="time-outline" size={18} color={colors.primaryBlue} />
            <Text style={styles.etaText}>
              {ride.status === "in_progress"
                ? t("ride.etaDestination", "Arrivo: ~{{eta}}", { eta })
                : t("ride.etaPickup", "Autista tra ~{{eta}}", { eta })}
            </Text>
          </View>
        )}

        <Text style={[styles.fareText, { color: colors.dark }]}>
          {t("ride.fare")}: €{Number(ride.fare_final || ride.fare_estimate).toFixed(2)}
        </Text>

        <View style={styles.actions}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Ionicons name="close-circle-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.cancelBtnText}>{t("ride.cancelRide")}</Text>
            </TouchableOpacity>
          )}

          {ride.driver_id && !isCompleted && (
            <TouchableOpacity style={styles.chatBtn} onPress={openChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={20} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.chatBtnText}>{t("ride.chat")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isCompleted && !ride.customer_rating && (
          <View style={styles.ratingSection}>
            <Text style={[styles.ratingPrompt, { color: colors.dark }]}>{t("ride.ratePrompt")}</Text>
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
  container: { flex: 1, backgroundColor: staticColors.lightBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: staticColors.lightBg, gap: spacing.md },
  loadingText: { fontSize: 16, color: staticColors.bodyText, marginTop: spacing.sm },
  emptyText: { fontSize: 16, color: staticColors.bodyText },
  map: { flex: 1 },
  infoPanel: {
    backgroundColor: staticColors.white,
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
  statusText: { color: staticColors.white, fontWeight: "bold", fontSize: 14 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  driverInfo: { fontSize: 16, color: staticColors.dark, fontWeight: "500" },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: staticColors.primaryBlue + "12",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    marginBottom: spacing.md,
    alignSelf: "flex-start",
  },
  etaText: {
    fontSize: 15,
    fontWeight: "700",
    color: staticColors.primaryBlue,
  },
  fareText: { fontSize: 20, fontWeight: "bold", color: staticColors.dark, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: staticColors.error,
    padding: 14,
    borderRadius: radii.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  cancelBtnText: { color: staticColors.white, fontWeight: "bold", fontSize: 16 },
  chatBtn: {
    flex: 1,
    backgroundColor: staticColors.primaryBlue,
    padding: 14,
    borderRadius: radii.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  chatBtnText: { color: staticColors.white, fontWeight: "bold", fontSize: 16 },
  ratingSection: { marginTop: spacing.md, alignItems: "center" },
  ratingPrompt: { fontSize: 16, color: staticColors.dark, marginBottom: spacing.sm, fontWeight: "500" },
  stars: { flexDirection: "row", gap: spacing.sm },
  submitBtn: {
    backgroundColor: staticColors.primaryBlue,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  submitBtnText: { fontWeight: "bold", fontSize: 16, color: staticColors.white },
});
