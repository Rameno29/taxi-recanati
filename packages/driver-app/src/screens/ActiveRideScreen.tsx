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
import { useTranslation } from "react-i18next";
import MapPlaceholder from "../components/MapPlaceholder";
import { useFocusEffect } from "@react-navigation/native";
import { useDriver } from "../context/DriverContext";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "ActiveRide">;

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  accepted: { next: "arriving", label: "ride.markArriving", color: "#9C27B0" },
  arriving: { next: "in_progress", label: "ride.startRide", color: "#2196F3" },
  in_progress: { next: "completed", label: "ride.completeRide", color: "#4CAF50" },
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
    // Open in device maps app
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
          <View>
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
          <TouchableOpacity style={styles.quickBtn} onPress={openNavigation}>
            <Text style={styles.quickBtnText}>{t("ride.navigate")}</Text>
          </TouchableOpacity>
          {activeRide.customer_phone && (
            <TouchableOpacity style={styles.quickBtn} onPress={callCustomer}>
              <Text style={styles.quickBtnText}>{t("ride.callCustomer")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.quickBtn} onPress={openChat}>
            <Text style={styles.quickBtnText}>{t("ride.chat")}</Text>
          </TouchableOpacity>
        </View>

        {/* Main action button */}
        {flow && (
          <TouchableOpacity
            style={[styles.mainAction, { backgroundColor: flow.color }]}
            onPress={handleNextStatus}
          >
            <Text style={styles.mainActionText}>{t(flow.label as any)}</Text>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryActions}>
          {showNoShow && (
            <TouchableOpacity style={styles.noShowBtn} onPress={handleNoShow}>
              <Text style={styles.noShowBtnText}>{t("ride.reportNoShow")}</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
  map: { flex: 1 },
  panel: {
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
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  customerName: { fontSize: 18, fontWeight: "bold", color: "#333" },
  statusLabel: { fontSize: 14, color: "#666", marginTop: 2 },
  fare: { fontSize: 24, fontWeight: "bold", color: "#1B5E20" },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  quickBtnText: { fontSize: 12, fontWeight: "600", color: "#333" },
  mainAction: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  mainActionText: { color: "#fff", fontWeight: "bold", fontSize: 18 },
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  noShowBtn: {
    flex: 1,
    backgroundColor: "#FF9800",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  noShowBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F44336",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
