import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import type { EarningsSummary } from "../types";

export default function EarningsScreen() {
  const { t } = useTranslation();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/drivers/earnings");
      if (res.ok) {
        const data = await res.json();
        setEarnings(data);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [])
  );

  if (!earnings && !loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t("earnings.noData")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchEarnings} />
      }
    >
      {/* Today */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("earnings.today")}</Text>
        <Text style={styles.cardAmount}>
          €{earnings ? Number(earnings.today).toFixed(2) : "0.00"}
        </Text>
        <Text style={styles.cardRides}>
          {earnings?.total_rides_today || 0} {t("earnings.rides")}
        </Text>
      </View>

      {/* This week */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("earnings.week")}</Text>
        <Text style={styles.cardAmount}>
          €{earnings ? Number(earnings.week).toFixed(2) : "0.00"}
        </Text>
        <Text style={styles.cardRides}>
          {earnings?.total_rides_week || 0} {t("earnings.rides")}
        </Text>
      </View>

      {/* This month */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("earnings.month")}</Text>
        <Text style={styles.cardAmount}>
          €{earnings ? Number(earnings.month).toFixed(2) : "0.00"}
        </Text>
        <Text style={styles.cardRides}>
          {earnings?.total_rides_month || 0} {t("earnings.rides")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: { fontSize: 14, color: "#666", marginBottom: 8 },
  cardAmount: { fontSize: 36, fontWeight: "bold", color: "#1B5E20" },
  cardRides: { fontSize: 14, color: "#999", marginTop: 4 },
});
