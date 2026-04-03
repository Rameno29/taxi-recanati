import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import MapPlaceholder from "../components/MapPlaceholder";
import { useDriver } from "../context/DriverContext";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../navigation/AppNavigator";

type Props = BottomTabScreenProps<MainTabParamList, "Dashboard">;

const RECANATI = {
  latitude: 43.4034,
  longitude: 13.5498,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function DashboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    isOnline,
    toggleOnline,
    incomingRequest,
    acceptRide,
    declineRide,
    activeRide,
  } = useDriver();

  const handleToggle = async () => {
    try {
      await toggleOnline();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    }
  };

  const handleAccept = async () => {
    if (!incomingRequest) return;
    try {
      await acceptRide(incomingRequest.id);
      // Navigate to active ride tab
      navigation.navigate("ActiveRide");
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    }
  };

  // If there's an active ride, prompt to go to ride tab
  if (activeRide) {
    return (
      <View style={styles.container}>
        <View style={styles.activeRideBanner}>
          <Text style={styles.bannerText}>{t("ride.activeRide")}</Text>
          <TouchableOpacity
            style={styles.goToRideBtn}
            onPress={() => navigation.navigate("ActiveRide")}
          >
            <Text style={styles.goToRideBtnText}>{t("tabs.ride")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapPlaceholder style={styles.map} />

      {/* Online/Offline toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, isOnline ? styles.toggleOnline : styles.toggleOffline]}
          onPress={handleToggle}
        >
          <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.toggleText}>
            {isOnline ? t("dashboard.goOffline") : t("dashboard.goOnline")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status indicator */}
      {isOnline && !incomingRequest && (
        <View style={styles.waitingBanner}>
          <Text style={styles.waitingText}>{t("dashboard.waitingForRides")}</Text>
        </View>
      )}

      {/* Incoming ride request */}
      {incomingRequest && (
        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>{t("dashboard.newRequest")}</Text>

          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>{t("dashboard.pickup")}:</Text>
            <Text style={styles.requestValue} numberOfLines={1}>
              {incomingRequest.pickup_address ||
                `${Number(incomingRequest.pickup_lat).toFixed(4)}, ${Number(incomingRequest.pickup_lng).toFixed(4)}`}
            </Text>
          </View>

          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>{t("dashboard.destination")}:</Text>
            <Text style={styles.requestValue} numberOfLines={1}>
              {incomingRequest.destination_address ||
                `${Number(incomingRequest.destination_lat).toFixed(4)}, ${Number(incomingRequest.destination_lng).toFixed(4)}`}
            </Text>
          </View>

          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>{t("dashboard.fare")}:</Text>
            <Text style={styles.requestFare}>
              €{Number(incomingRequest.fare_estimate).toFixed(2)}
            </Text>
          </View>

          <View style={styles.requestRow}>
            <Text style={styles.requestLabel}>{t("dashboard.distance")}:</Text>
            <Text style={styles.requestValue}>
              {(Number(incomingRequest.distance_meters) / 1000).toFixed(1)} km
            </Text>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineBtn} onPress={declineRide}>
              <Text style={styles.declineBtnText}>{t("dashboard.decline")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
              <Text style={styles.acceptBtnText}>{t("dashboard.accept")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  toggleContainer: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleOnline: { backgroundColor: "#F44336" },
  toggleOffline: { backgroundColor: "#1B5E20" },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  dotOnline: { backgroundColor: "#4CAF50" },
  dotOffline: { backgroundColor: "#999" },
  toggleText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  waitingBanner: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  waitingText: { color: "#666", fontSize: 14 },
  activeRideBanner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 24,
  },
  bannerText: { fontSize: 20, fontWeight: "bold", color: "#1B5E20", marginBottom: 16 },
  goToRideBtn: {
    backgroundColor: "#1B5E20",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  goToRideBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  requestCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1B5E20",
    marginBottom: 12,
    textAlign: "center",
  },
  requestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  requestLabel: { fontSize: 14, color: "#666" },
  requestValue: { fontSize: 14, color: "#333", flex: 1, textAlign: "right" },
  requestFare: { fontSize: 18, fontWeight: "bold", color: "#1B5E20" },
  requestActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F44336",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  declineBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  acceptBtn: {
    flex: 2,
    backgroundColor: "#1B5E20",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
