import React, { useCallback } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import MapPlaceholder from "../components/MapPlaceholder";
import { useFocusEffect } from "@react-navigation/native";
import { useDriver } from "../context/DriverContext";
import { colors, spacing, radii, fonts } from "../theme";
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
  const { activeRide, updateRideStatus, refreshActiveRide } = useDriver();

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
        contentContainerStyle={styles.center}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshActiveRide} />
        }
      >
        <Ionicons name="car-sport-outline" size={64} color={colors.border} />
        <Text style={styles.emptyText}>{t("ride.noActiveRide")}</Text>
      </ScrollView>
    );
  }

  const flow = STATUS_FLOW[activeRide.status];
  const showNoShow = activeRide.status === "arriving";
  const canCancel = ["accepted", "arriving"].includes(activeRide.status);

  return (
    <View style={styles.container}>
      <MapPlaceholder
        style={styles.map}
        markers={[
          { latitude: Number(activeRide.pickup_lat), longitude: Number(activeRide.pickup_lng), color: "green", title: t("dashboard.pickup") },
          { latitude: Number(activeRide.destination_lat), longitude: Number(activeRide.destination_lng), color: "red", title: t("dashboard.destination") },
        ]}
      />

      <View style={styles.panel}>
        {/* Customer info */}
        <View style={styles.customerRow}>
          <View style={styles.customerAvatar}>
            <Ionicons name="person" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>
              {activeRide.customer_name || t("ride.customer")}
            </Text>
            <Text style={styles.statusLabel}>
              {t(`ride.${activeRide.status}` as any)}
            </Text>
          </View>
          <Text style={styles.fare}>
            €{Number(activeRide.fare_final || activeRide.fare_estimate).toFixed(2)}
          </Text>
        </View>

        {/* Quick actions row */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={openNavigation} activeOpacity={0.7}>
            <Ionicons name="navigate-outline" size={22} color={colors.primaryBlue} />
            <Text style={styles.quickBtnText}>{t("ride.navigate")}</Text>
          </TouchableOpacity>
          {activeRide.customer_phone && (
            <TouchableOpacity style={styles.quickBtn} onPress={callCustomer} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={22} color={colors.primaryBlue} />
              <Text style={styles.quickBtnText}>{t("ride.callCustomer")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickBtn} onPress={openChat} activeOpacity={0.7}>
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
            <Ionicons name={flow.icon as any} size={24} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.mainActionText}>{t(flow.label as any)}</Text>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          {showNoShow && (
            <TouchableOpacity style={styles.noShowBtn} onPress={handleNoShow} activeOpacity={0.8}>
              <Ionicons name="eye-off-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
              <Text style={styles.noShowBtnText}>{t("ride.reportNoShow")}</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Ionicons name="close-circle-outline" size={18} color={colors.white} style={{ marginRight: 6 }} />
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
  emptyText: { fontSize: fonts.body, color: colors.bodyText },
  map: { flex: 1 },
  panel: {
    backgroundColor: colors.white,
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
    backgroundColor: colors.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
  },
  customerName: { fontSize: 18, fontWeight: "bold", color: colors.dark },
  statusLabel: { fontSize: fonts.label, color: colors.bodyText, marginTop: 2 },
  fare: { fontSize: 24, fontWeight: "bold", color: colors.primaryBlue },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.primaryBlueLight,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
    gap: 4,
  },
  quickBtnText: { fontSize: fonts.caption, fontWeight: "600", color: colors.primaryBlue },
  mainAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  mainActionText: { color: colors.white, fontWeight: "bold", fontSize: 18 },
  secondaryActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  noShowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  noShowBtnText: { color: colors.white, fontWeight: "bold", fontSize: fonts.label },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  cancelBtnText: { color: colors.white, fontWeight: "bold", fontSize: fonts.label },
});
