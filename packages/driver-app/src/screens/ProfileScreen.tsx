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
import { useAuth } from "../context/AuthContext";
import { useDriver } from "../context/DriverContext";
import { persistLanguage } from "../i18n";
import { colors, spacing, radii, fonts } from "../theme";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { driver, isOnline } = useDriver();

  const toggleLanguage = () => {
    const newLang = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(newLang);
    persistLanguage(newLang);
  };

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.logout"),
        style: "destructive",
        onPress: logout,
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={[styles.statusBadge, isOnline ? styles.online : styles.offline]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.driverGreen : colors.error }]} />
          <Text style={[styles.statusText, { color: isOnline ? colors.driverGreen : colors.error }]}>
            {isOnline ? t("dashboard.online") : t("dashboard.offline")}
          </Text>
        </View>
      </View>

      {driver && (
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="card-outline" size={20} color={colors.primaryBlue} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>{t("profile.licensePlate")}</Text>
            </View>
            <Text style={styles.rowValue}>{driver.license_plate}</Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="car-outline" size={20} color={colors.primaryBlue} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>{t("profile.vehicleType")}</Text>
            </View>
            <Text style={styles.rowValue}>{driver.vehicle_type}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={toggleLanguage} activeOpacity={0.6}>
          <View style={styles.rowLeft}>
            <Ionicons name="language-outline" size={20} color={colors.primaryBlue} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{t("profile.language")}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>
              {i18n.language === "it" ? t("profile.italian") : t("profile.english")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>{t("auth.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightBg, padding: spacing.md },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: { fontSize: 30, fontWeight: "bold", color: colors.white },
  name: { fontSize: 20, fontWeight: "bold", color: colors.dark },
  email: { fontSize: fonts.label, color: colors.bodyText, marginTop: spacing.xs },
  phone: { fontSize: fonts.label, color: colors.bodyText, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    gap: spacing.sm,
  },
  online: { backgroundColor: colors.driverGreenLight },
  offline: { backgroundColor: "#FFEBEE" },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: { fontSize: fonts.caption, fontWeight: "bold" },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBg,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rowIcon: { marginRight: spacing.sm },
  rowLabel: { fontSize: fonts.body, color: colors.dark },
  rowValue: { fontSize: fonts.body, color: colors.bodyText },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: { color: colors.white, fontWeight: "bold", fontSize: fonts.body },
});
