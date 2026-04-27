import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { persistLanguage } from "../i18n";
import { spacing, radii, shadows } from "../theme";
import type { RootStackParamList } from "../navigation/AppNavigator";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { mode, setMode, isDark, colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const cycleTheme = () => {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
  };

  const themeLabel = mode === "system"
    ? t("profile.themeSystem", "Sistema")
    : mode === "dark"
      ? t("profile.themeDark", "Scuro")
      : t("profile.themeLight", "Chiaro");

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.lightBg, padding: spacing.md }}>
      <View style={{ backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, alignItems: "center", marginBottom: spacing.md, ...shadows.card }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryBlue, justifyContent: "center", alignItems: "center", marginBottom: spacing.md }}>
          <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFF" }}>
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.dark }}>{user?.name}</Text>
        <Text style={{ fontSize: 14, color: colors.bodyText, marginTop: spacing.xs }}>{user?.email}</Text>
        <Text style={{ fontSize: 14, color: colors.bodyText, marginTop: 2 }}>{user?.phone}</Text>
      </View>

      <View style={{ backgroundColor: colors.white, borderRadius: radii.md, marginBottom: spacing.md, overflow: "hidden", ...shadows.card }}>
        <TouchableOpacity
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={toggleLanguage}
          activeOpacity={0.6}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="language-outline" size={22} color={colors.primaryBlue} />
            <Text style={{ fontSize: 16, color: colors.dark }}>{t("profile.language")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={{ fontSize: 16, color: colors.bodyText }}>
              {i18n.language === "it" ? t("profile.italian") : t("profile.english")}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
          onPress={cycleTheme}
          activeOpacity={0.6}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color={colors.primaryBlue} />
            <Text style={{ fontSize: 16, color: colors.dark }}>{t("profile.theme", "Tema")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Text style={{ fontSize: 16, color: colors.bodyText }}>{themeLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md }}
          onPress={() => navigation.navigate("PaymentMethods")}
          activeOpacity={0.6}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="card-outline" size={22} color={colors.primaryBlue} />
            <Text style={{ fontSize: 16, color: colors.dark }}>{t("profile.paymentMethods", "Metodi di pagamento")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.bodyText} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: colors.error, borderRadius: radii.md, padding: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", marginTop: spacing.md }}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>{t("auth.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}
