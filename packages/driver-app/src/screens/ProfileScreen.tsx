import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useDriver } from "../context/DriverContext";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { driver, isOnline } = useDriver();

  const toggleLanguage = () => {
    const newLang = i18n.language === "it" ? "en" : "it";
    i18n.changeLanguage(newLang);
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
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]}>
          <Text style={styles.statusDotText}>
            {isOnline ? t("dashboard.online") : t("dashboard.offline")}
          </Text>
        </View>
      </View>

      {driver && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("profile.licensePlate")}</Text>
            <Text style={styles.rowValue}>{driver.license_plate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t("profile.vehicleType")}</Text>
            <Text style={styles.rowValue}>{driver.vehicle_type}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
          <Text style={styles.rowLabel}>{t("profile.language")}</Text>
          <Text style={styles.rowValue}>
            {i18n.language === "it" ? t("profile.italian") : t("profile.english")}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t("auth.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  name: { fontSize: 20, fontWeight: "bold", color: "#333" },
  email: { fontSize: 14, color: "#666", marginTop: 4 },
  phone: { fontSize: 14, color: "#666", marginTop: 2 },
  statusDot: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  online: { backgroundColor: "#E8F5E9" },
  offline: { backgroundColor: "#FFEBEE" },
  statusDotText: { fontSize: 12, fontWeight: "bold", color: "#333" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: { fontSize: 16, color: "#333" },
  rowValue: { fontSize: 16, color: "#666" },
  logoutBtn: {
    backgroundColor: "#F44336",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
