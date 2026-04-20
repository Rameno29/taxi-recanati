import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useDriver } from "../context/DriverContext";
import { useTheme } from "../context/ThemeContext";
import { persistLanguage } from "../i18n";
import { spacing, radii, fonts } from "../theme";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { driver, isOnline } = useDriver();
  const { mode, setMode, isDark, colors } = useTheme();

  const cycleTheme = () => {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };
  const themeLabel = mode === "system" ? t("profile.themeSystem", "Sistema")
    : mode === "dark" ? t("profile.themeDark", "Scuro") : t("profile.themeLight", "Chiaro");

  const toggleLanguage = () => {
    const newLang = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(newLang);
    persistLanguage(newLang);
  };

  const handleLogout = () => {
    Alert.alert(t("auth.logout"), t("auth.logoutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.logout"), style: "destructive", onPress: logout },
    ]);
  };

  const row = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border };

  return (
    <View style={{ flex: 1, backgroundColor: colors.lightBg, padding: spacing.md }}>
      <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primaryBlue, justifyContent: "center", alignItems: "center", marginBottom: spacing.md }}>
          <Text style={{ fontSize: 30, fontWeight: "bold", color: "#FFF" }}>
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: colors.dark }}>{user?.name}</Text>
        <Text style={{ fontSize: fonts.label, color: colors.bodyText, marginTop: spacing.xs }}>{user?.email}</Text>
        <Text style={{ fontSize: fonts.label, color: colors.bodyText, marginTop: 2 }}>{user?.phone}</Text>
        <View style={{
          flexDirection: "row", alignItems: "center", marginTop: spacing.md,
          paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, gap: spacing.sm,
          backgroundColor: isOnline ? colors.driverGreenLight : "#FFEBEE",
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? colors.driverGreen : colors.error }} />
          <Text style={{ fontSize: fonts.caption, fontWeight: "bold", color: isOnline ? colors.driverGreen : colors.error }}>
            {isOnline ? t("dashboard.online") : t("dashboard.offline")}
          </Text>
        </View>
      </View>

      {driver && (
        <View style={{ backgroundColor: colors.white, borderRadius: radii.md, marginBottom: spacing.md, overflow: "hidden" }}>
          <View style={row}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="card-outline" size={20} color={colors.primaryBlue} style={{ marginRight: spacing.sm }} />
              <Text style={{ fontSize: fonts.body, color: colors.dark }}>{t("profile.licensePlate")}</Text>
            </View>
            <Text style={{ fontSize: fonts.body, color: colors.bodyText }}>{driver.license_plate}</Text>
          </View>
          <View style={row}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="car-outline" size={20} color={colors.primaryBlue} style={{ marginRight: spacing.sm }} />
              <Text style={{ fontSize: fonts.body, color: colors.dark }}>{t("profile.vehicleType")}</Text>
            </View>
            <Text style={{ fontSize: fonts.body, color: colors.bodyText }}>{driver.vehicle_type}</Text>
          </View>
        </View>
      )}

      <View style={{ backgroundColor: colors.white, borderRadius: radii.md, marginBottom: spacing.md, overflow: "hidden" }}>
        <TouchableOpacity style={row} onPress={toggleLanguage} activeOpacity={0.6}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="language-outline" size={20} color={colors.primaryBlue} style={{ marginRight: spacing.sm }} />
            <Text style={{ fontSize: fonts.body, color: colors.dark }}>{t("profile.language")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={{ fontSize: fonts.body, color: colors.bodyText }}>
              {i18n.language === "it" ? t("profile.italian") : t("profile.english")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={{ ...row, borderBottomWidth: 0 }} onPress={cycleTheme} activeOpacity={0.6}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name={isDark ? "moon" : "sunny-outline"} size={20} color={colors.primaryBlue} style={{ marginRight: spacing.sm }} />
            <Text style={{ fontSize: fonts.body, color: colors.dark }}>{t("profile.theme", "Tema")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={{ fontSize: fonts.body, color: colors.bodyText }}>{themeLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.error, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md }}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: fonts.body }}>{t("auth.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}
