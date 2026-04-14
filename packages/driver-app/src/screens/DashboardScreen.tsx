import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { useDriver } from "../context/DriverContext";
import { colors, spacing, radii, fonts } from "../theme";
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
  const insets = useSafeAreaInsets();
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
          <Ionicons name="car-sport" size={48} color={colors.primaryBlue} style={{ marginBottom: spacing.md }} />
          <Text style={styles.bannerText}>{t("ride.activeRide")}</Text>
          <TouchableOpacity
            style={styles.goToRideBtn}
            onPress={() => navigation.navigate("ActiveRide")}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={20} color={colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.goToRideBtnText}>{t("tabs.ride")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LiveMap style={styles.map} initialRegion={RECANATI} showUserLocation />

      {/* Online/Offline toggle */}
      <View style={[styles.toggleContainer, { top: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.toggleBtn, isOnline ? styles.toggleOnline : styles.toggleOffline]}
          onPress={handleToggle}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isOnline ? "power" : "power-outline"}
            size={22}
            color={colors.white}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.toggleText}>
            {isOnline ? t("dashboard.goOffline") : t("dashboard.goOnline")}
          </Text>
          {isOnline && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Status indicator */}
      {isOnline && !incomingRequest && (
        <View style={styles.waitingBanner}>
          <Ionicons name="time-outline" size={18} color={colors.bodyText} style={{ marginRight: 8 }} />
          <Text style={styles.waitingText}>{t("dashboard.waitingForRides")}</Text>
        </View>
      )}

      {/* Incoming ride request */}
      {incomingRequest && (
        <View style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Ionicons name="notifications" size={24} color={colors.accentCoral} />
            <Text style={styles.requestTitle}>{t("dashboard.newRequest")}</Text>
          </View>

          <View style={styles.requestDetails}>
            <View style={styles.requestRow}>
              <Ionicons name="location" size={18} color={colors.driverGreen} />
              <View style={styles.requestRowContent}>
                <Text style={styles.requestLabel}>{t("dashboard.pickup")}</Text>
                <Text style={styles.requestValue} numberOfLines={1}>
                  {incomingRequest.pickup_address ||
                    `${Number(incomingRequest.pickup_lat).toFixed(4)}, ${Number(incomingRequest.pickup_lng).toFixed(4)}`}
                </Text>
              </View>
            </View>

            <View style={styles.requestDivider} />

            <View style={styles.requestRow}>
              <Ionicons name="flag" size={18} color={colors.accentCoral} />
              <View style={styles.requestRowContent}>
                <Text style={styles.requestLabel}>{t("dashboard.destination")}</Text>
                <Text style={styles.requestValue} numberOfLines={1}>
                  {incomingRequest.destination_address ||
                    `${Number(incomingRequest.destination_lat).toFixed(4)}, ${Number(incomingRequest.destination_lng).toFixed(4)}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.requestStats}>
            <View style={styles.requestStat}>
              <Ionicons name="cash-outline" size={20} color={colors.primaryBlue} />
              <Text style={styles.requestStatValue}>
                €{Number(incomingRequest.fare_estimate).toFixed(2)}
              </Text>
              <Text style={styles.requestStatLabel}>{t("dashboard.fare")}</Text>
            </View>
            <View style={styles.requestStatDivider} />
            <View style={styles.requestStat}>
              <Ionicons name="speedometer-outline" size={20} color={colors.primaryBlue} />
              <Text style={styles.requestStatValue}>
                {(Number(incomingRequest.distance_meters) / 1000).toFixed(1)} km
              </Text>
              <Text style={styles.requestStatLabel}>{t("dashboard.distance")}</Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity style={styles.declineBtn} onPress={declineRide} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color={colors.error} />
              <Text style={styles.declineBtnText}>{t("dashboard.decline")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={20} color={colors.white} />
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
    // top set dynamically via useSafeAreaInsets()
    alignSelf: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleOnline: { backgroundColor: colors.error },
  toggleOffline: { backgroundColor: colors.primaryBlue },
  liveIndicator: { marginLeft: 10 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.driverGreen,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  toggleText: { color: colors.white, fontWeight: "bold", fontSize: fonts.body },
  waitingBanner: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  waitingText: { color: colors.bodyText, fontSize: fonts.label },
  activeRideBanner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primaryBlueLight,
    padding: spacing.lg,
  },
  bannerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primaryBlue,
    marginBottom: spacing.md,
  },
  goToRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryBlue,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  goToRideBtnText: { color: colors.white, fontWeight: "bold", fontSize: fonts.body },
  requestCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.dark,
  },
  requestDetails: {
    backgroundColor: colors.lightBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  requestRowContent: { flex: 1 },
  requestLabel: { fontSize: fonts.caption, color: colors.bodyText },
  requestValue: { fontSize: fonts.label, color: colors.dark, fontWeight: "500", marginTop: 2 },
  requestDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginLeft: 26,
  },
  requestStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  requestStat: { flex: 1, alignItems: "center", gap: 2 },
  requestStatValue: { fontSize: 20, fontWeight: "bold", color: colors.dark },
  requestStatLabel: { fontSize: fonts.caption, color: colors.bodyText },
  requestStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.error,
    padding: 14,
    borderRadius: radii.md,
  },
  declineBtnText: { color: colors.error, fontWeight: "bold", fontSize: fonts.body },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryBlue,
    padding: 14,
    borderRadius: radii.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  acceptBtnText: { color: colors.white, fontWeight: "bold", fontSize: fonts.body },
  requestFare: { fontSize: 18, fontWeight: "bold", color: colors.primaryBlue },
});
