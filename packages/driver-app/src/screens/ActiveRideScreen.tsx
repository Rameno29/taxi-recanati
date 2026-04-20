import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
} from "react-native";
import * as ExpoLocation from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { useFocusEffect } from "@react-navigation/native";
import { useDriver } from "../context/DriverContext";
import { fetchRoute } from "../services/routing";
import { colors as staticColors, spacing, radii, fonts } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "ActiveRide">;

const STATUS_FLOW: Record<string, { next: string; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  accepted: { next: "arriving", label: "ride.markArriving", color: "#4357AD", icon: "navigate" },
  arriving: { next: "in_progress", label: "ride.startRide", color: "#4357AD", icon: "play-circle" },
  in_progress: { next: "completed", label: "ride.completeRide", color: "#1B5E20", icon: "checkmark-circle" },
};

export default function ActiveRideScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { activeRide, updateRideStatus, refreshActiveRide } = useDriver();
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<string | null>(null);

  // Fetch driving route when ride loads
  useEffect(() => {
    if (!activeRide) { setRouteCoords([]); return; }
    let cancelled = false;
    fetchRoute(
      Number(activeRide.pickup_lat), Number(activeRide.pickup_lng),
      Number(activeRide.destination_lat), Number(activeRide.destination_lng)
    ).then((result) => {
      if (!cancelled && result) setRouteCoords(result.coordinates);
    });
    return () => { cancelled = true; };
  }, [activeRide?.id]);

  // Compute ETA from driver's current position
  useEffect(() => {
    if (!activeRide) { setEta(null); return; }
    let cancelled = false;
    const computeEta = async () => {
      try {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        const s = activeRide.status;
        const tLat = (s === "accepted" || s === "arriving") ? Number(activeRide.pickup_lat) : Number(activeRide.destination_lat);
        const tLng = (s === "accepted" || s === "arriving") ? Number(activeRide.pickup_lng) : Number(activeRide.destination_lng);
        const result = await fetchRoute(loc.coords.latitude, loc.coords.longitude, tLat, tLng);
        if (!cancelled && result) {
          setEta(`${Math.max(1, Math.round(result.durationSeconds / 60))} min`);
        }
      } catch { /* skip */ }
    };
    computeEta();
    const interval = setInterval(computeEta, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeRide?.id, activeRide?.status]);

  useFocusEffect(
    useCallback(() => {
      refreshActiveRide();
    }, [])
  );

  const handleNextStatus = async () => {
    if (!activeRide) return;
    const flow = STATUS_FLOW[activeRide.status];
    if (!flow) return;

    try {
      await updateRideStatus(flow.next);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    }
  };

  const handleCancel = () => {
    Alert.alert(t("ride.cancelRide"), t("ride.cancelConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await updateRideStatus("cancelled", "Driver cancelled");
          } catch (err: any) {
            Alert.alert(t("common.error"), err.message);
          }
        },
      },
    ]);
  };

  const handleNoShow = async () => {
    try {
      await updateRideStatus("no_show");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    }
  };

  const openNavigation = () => {
    if (!activeRide) return;
    const lat = activeRide.status === "accepted" || activeRide.status === "arriving"
      ? activeRide.pickup_lat
      : activeRide.destination_lat;
    const lng = activeRide.status === "accepted" || activeRide.status === "arriving"
      ? activeRide.pickup_lng
      : activeRide.destination_lng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  const callCustomer = () => {
    if (activeRide?.customer_phone) {
      Linking.openURL(`tel:${activeRide.customer_phone}`);
    }
  };

  const openChat = () => {
    if (!activeRide) return;
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("Chat", { rideId: activeRide.id });
    }
  };

  if (!activeRide) {
    return (
      <ScrollView
        contentContainerStyle={[styles.center, { backgroundColor: colors.lightBg }]}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshActiveRide} />
        }
      >
        <Ionicons name="car-sport-outline" size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.bodyText }]}>{t("ride.noActiveRide")}</Text>
      </ScrollView>
    );
  }

  const flow = STATUS_FLOW[activeRide.status];
  const showNoShow = activeRide.status === "arriving";
  const canCancel = ["accepted", "arriving"].includes(activeRide.status);

  return (
    <View style={styles.container}>
      <LiveMap
        style={styles.map}
        showUserLocation
        routeCoordinates={routeCoords}
        markers={[
          {
            coordinate: { latitude: Number(activeRide.pickup_lat), longitude: Number(activeRide.pickup_lng) },
            color: "green",
            title: t("dashboard.pickup"),
          },
          {
            coordinate: { latitude: Number(activeRide.destination_lat), longitude: Number(activeRide.destination_lng) },
            color: "red",
            title: t("dashboard.destination"),
          },
        ]}
      />

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom + 10, spacing.lg), backgroundColor: colors.white }]}>
        {/* Customer info */}
        <View style={styles.customerRow}>
          <View style={styles.customerAvatar}>
            <Ionicons name="person" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.customerName, { color: colors.dark }]}>
              {activeRide.customer_name || t("ride.customer")}
            </Text>
            <Text style={[styles.statusLabel, { color: colors.bodyText }]}>
              {t(`ride.${activeRide.status}` as any)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.fare}>
              €{Number(activeRide.fare_final || activeRide.fare_estimate).toFixed(2)}
            </Text>
            {eta && <Text style={styles.etaText}>ETA: {eta}</Text>}
          </View>
        </View>

        {/* Quick actions row */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primaryBlueLight }]} onPress={openNavigation} activeOpacity={0.7}>
            <Ionicons name="navigate-outline" size={22} color={colors.primaryBlue} />
            <Text style={styles.quickBtnText}>{t("ride.navigate")}</Text>
          </TouchableOpacity>
          {activeRide.customer_phone && (
            <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primaryBlueLight }]} onPress={callCustomer} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={22} color={colors.primaryBlue} />
              <Text style={styles.quickBtnText}>{t("ride.callCustomer")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.primaryBlueLight }]} onPress={openChat} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.primaryBlue} />
            <Text style={styles.quickBtnText}>{t("ride.chat")}</Text>
          </TouchableOpacity>
        </View>

        {/* Main action button */}
        {flow && (
          <TouchableOpacity
            style={[styles.mainAction, { backgroundColor: flow.color }]}
            onPress={handleNextStatus}
            activeOpacity={0.8}
          >
            <Ionicons name={flow.icon as any} size={24} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.mainActionText}>{t(flow.label as any)}</Text>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          {showNoShow && (
            <TouchableOpacity style={styles.noShowBtn} onPress={handleNoShow} activeOpacity={0.8}>
              <Ionicons name="eye-off-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.noShowBtnText}>{t("ride.reportNoShow")}</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Ionicons name="close-circle-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.cancelBtnText}>{t("ride.cancelRide")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  emptyText: { fontSize: fonts.body, color: staticColors.bodyText },
  map: { flex: 1 },
  panel: {
    backgroundColor: staticColors.white,
    padding: spacing.lg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: staticColors.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
  },
  customerName: { fontSize: 18, fontWeight: "bold", color: staticColors.dark },
  statusLabel: { fontSize: fonts.label, color: staticColors.bodyText, marginTop: 2 },
  fare: { fontSize: 24, fontWeight: "bold", color: staticColors.primaryBlue },
  etaText: { fontSize: 13, fontWeight: "700", color: staticColors.primaryBlue, marginTop: 2 },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: staticColors.primaryBlueLight,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    gap: 4,
  },
  quickBtnText: { fontSize: fonts.caption, fontWeight: "600", color: staticColors.primaryBlue },
  mainAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    shadowColor: staticColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  mainActionText: { color: "#FFF", fontWeight: "bold", fontSize: 18 },
  secondaryActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  noShowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: staticColors.warning,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  noShowBtnText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.label },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: staticColors.error,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  cancelBtnText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.label },
});
