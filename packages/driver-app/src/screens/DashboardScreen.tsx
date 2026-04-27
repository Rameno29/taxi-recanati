import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { useDriver } from "../context/DriverContext";
import { colors as staticColors, spacing, radii, fonts } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
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
  const colors = useThemeColors();
  const {
    isOnline,
    toggleOnline,
    incomingRequest,
    availableRides,
    acceptRide,
    declineRide,
    activeRide,
  } = useDriver();

  const moreAvailable = Math.max(0, availableRides.length - 1);

  // Slide-up animation for incoming request card
  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (incomingRequest) {
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }).start();
      // Pulse the accept button
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      slideAnim.setValue(400);
    }
  }, [incomingRequest?.id]);

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
        <View style={[styles.activeRideBanner, { backgroundColor: colors.primaryBlueLight }]}>
          <Ionicons name="car-sport" size={48} color={colors.primaryBlue} style={{ marginBottom: spacing.md }} />
          <Text style={[styles.bannerText, { color: colors.primaryBlue }]}>{t("ride.activeRide")}</Text>
          <TouchableOpacity
            style={styles.goToRideBtn}
            onPress={() => navigation.navigate("ActiveRide")}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={20} color="#FFF" style={{ marginRight: 8 }} />
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
            color="#FFF"
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
        <View style={[styles.waitingBanner, { backgroundColor: colors.white }]}>
          <Ionicons name="time-outline" size={18} color={colors.bodyText} style={{ marginRight: 8 }} />
          <Text style={[styles.waitingText, { color: colors.bodyText }]}>{t("dashboard.waitingForRides")}</Text>
        </View>
      )}

      {/* Incoming ride request */}
      {incomingRequest && (
        <Animated.View style={[styles.requestCard, { backgroundColor: colors.white, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.requestHeader}>
            <Ionicons name="notifications" size={24} color={colors.accentCoral} />
            <Text style={[styles.requestTitle, { color: colors.dark }]}>{t("dashboard.newRequest")}</Text>
            {moreAvailable > 0 && (
              <View style={[styles.moreBadge, { backgroundColor: colors.accentCoral }]}>
                <Text style={styles.moreBadgeText}>+{moreAvailable}</Text>
              </View>
            )}
          </View>

          <View style={[styles.requestDetails, { backgroundColor: colors.lightBg }]}>
            <View style={styles.requestRow}>
              <Ionicons name="location" size={18} color={colors.driverGreen} />
              <View style={styles.requestRowContent}>
                <Text style={[styles.requestLabel, { color: colors.bodyText }]}>{t("dashboard.pickup")}</Text>
                <Text style={[styles.requestValue, { color: colors.dark }]} numberOfLines={1}>
                  {incomingRequest.pickup_address ||
                    `${Number(incomingRequest.pickup_lat).toFixed(4)}, ${Number(incomingRequest.pickup_lng).toFixed(4)}`}
                </Text>
              </View>
            </View>

            <View style={[styles.requestDivider, { backgroundColor: colors.border }]} />

            <View style={styles.requestRow}>
              <Ionicons name="flag" size={18} color={colors.accentCoral} />
              <View style={styles.requestRowContent}>
                <Text style={[styles.requestLabel, { color: colors.bodyText }]}>{t("dashboard.destination")}</Text>
                <Text style={[styles.requestValue, { color: colors.dark }]} numberOfLines={1}>
                  {incomingRequest.destination_address ||
                    `${Number(incomingRequest.destination_lat).toFixed(4)}, ${Number(incomingRequest.destination_lng).toFixed(4)}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.requestStats}>
            <View style={styles.requestStat}>
              <Ionicons name="cash-outline" size={20} color={colors.primaryBlue} />
              <Text style={[styles.requestStatValue, { color: colors.dark }]}>
                €{Number(incomingRequest.fare_estimate).toFixed(2)}
              </Text>
              <Text style={[styles.requestStatLabel, { color: colors.bodyText }]}>{t("dashboard.fare")}</Text>
            </View>
            <View style={[styles.requestStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.requestStat}>
              <Ionicons name="speedometer-outline" size={20} color={colors.primaryBlue} />
              <Text style={[styles.requestStatValue, { color: colors.dark }]}>
                {(Number(incomingRequest.distance_meters) / 1000).toFixed(1)} km
              </Text>
              <Text style={[styles.requestStatLabel, { color: colors.bodyText }]}>{t("dashboard.distance")}</Text>
            </View>
          </View>

          <View style={styles.requestActions}>
            <TouchableOpacity style={[styles.declineBtn, { backgroundColor: colors.white, borderColor: colors.error }]} onPress={() => declineRide()} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color={colors.error} />
              <Text style={styles.declineBtnText}>{t("dashboard.decline")}</Text>
            </TouchableOpacity>
            <Animated.View style={{ flex: 2, transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.acceptBtnText}>{t("dashboard.accept")}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  toggleContainer: {
    position: "absolute",
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
  toggleOnline: { backgroundColor: staticColors.error },
  toggleOffline: { backgroundColor: staticColors.primaryBlue },
  liveIndicator: { marginLeft: 10 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: staticColors.driverGreen,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  toggleText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.body },
  waitingBanner: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    backgroundColor: staticColors.white,
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
  waitingText: { color: staticColors.bodyText, fontSize: fonts.label },
  activeRideBanner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: staticColors.primaryBlueLight,
    padding: spacing.lg,
  },
  bannerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: staticColors.primaryBlue,
    marginBottom: spacing.md,
  },
  goToRideBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: staticColors.primaryBlue,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.md,
    shadowColor: staticColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  goToRideBtnText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.body },
  requestCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: staticColors.white,
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
    color: staticColors.dark,
  },
  requestDetails: {
    backgroundColor: staticColors.lightBg,
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
  requestLabel: { fontSize: fonts.caption, color: staticColors.bodyText },
  requestValue: { fontSize: fonts.label, color: staticColors.dark, fontWeight: "500", marginTop: 2 },
  requestDivider: {
    height: 1,
    backgroundColor: staticColors.border,
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
  requestStatValue: { fontSize: 20, fontWeight: "bold", color: staticColors.dark },
  requestStatLabel: { fontSize: fonts.caption, color: staticColors.bodyText },
  requestStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: staticColors.border,
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
    backgroundColor: staticColors.white,
    borderWidth: 1.5,
    borderColor: staticColors.error,
    padding: 14,
    borderRadius: radii.md,
  },
  declineBtnText: { color: staticColors.error, fontWeight: "bold", fontSize: fonts.body },
  acceptBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: staticColors.primaryBlue,
    padding: 14,
    borderRadius: radii.md,
    shadowColor: staticColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  acceptBtnText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.body },
  requestFare: { fontSize: 18, fontWeight: "bold", color: staticColors.primaryBlue },
  moreBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    minWidth: 24,
    alignItems: "center",
  },
  moreBadgeText: { color: "#FFF", fontWeight: "bold", fontSize: fonts.caption },
});
