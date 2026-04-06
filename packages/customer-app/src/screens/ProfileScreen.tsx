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
import { persistLanguage } from "../i18n";
import { colors, spacing, radii, shadows } from "../theme";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

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
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={toggleLanguage} activeOpacity={0.6}>
          <View style={styles.rowLeft}>
            <Ionicons name="language-outline" size={22} color={colors.primaryBlue} />
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
    ...shadows.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryBlue,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { fontSize: 32, fontWeight: "bold", color: colors.white },
  name: { fontSize: 22, fontWeight: "bold", color: colors.dark },
  email: { fontSize: 14, color: colors.bodyText, marginTop: spacing.xs },
  phone: { fontSize: 14, color: colors.bodyText, marginTop: 2 },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.card,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  rowLabel: { fontSize: 16, color: colors.dark },
  rowValue: { fontSize: 16, color: colors.bodyText },
  logoutBtn: {
    backgroundColor: colors.error,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  logoutText: { color: colors.white, fontWeight: "bold", fontSize: 16 },
});
