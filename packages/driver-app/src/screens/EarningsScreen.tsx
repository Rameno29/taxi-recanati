import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { colors as staticColors, spacing, radii, fonts } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { EarningsSummary } from "../types";

type EarningPeriod = {
  labelKey: string;
  amountKey: keyof EarningsSummary;
  ridesKey: keyof EarningsSummary;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
};

const PERIODS: EarningPeriod[] = [
  {
    labelKey: "earnings.today",
    amountKey: "today",
    ridesKey: "total_rides_today",
    icon: "today-outline",
    accentColor: staticColors.accentCoral,
  },
  {
    labelKey: "earnings.week",
    amountKey: "week",
    ridesKey: "total_rides_week",
    icon: "calendar-outline",
    accentColor: staticColors.primaryBlue,
  },
  {
    labelKey: "earnings.month",
    amountKey: "month",
    ridesKey: "total_rides_month",
    icon: "calendar",
    accentColor: staticColors.driverGreen,
  },
];

export default function EarningsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
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
        <Ionicons name="wallet-outline" size={64} color={colors.border} />
        <Text style={[styles.emptyText, { color: colors.bodyText }]}>{t("earnings.noData")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.lightBg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchEarnings} />
      }
    >
      {PERIODS.map((period) => (
        <View key={period.labelKey} style={[styles.card, { backgroundColor: colors.white }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: period.accentColor + "15" }]}>
            <Ionicons name={period.icon as any} size={28} color={period.accentColor} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardLabel, { color: colors.bodyText }]}>{t(period.labelKey as any)}</Text>
            <Text style={[styles.cardAmount, { color: colors.dark }]}>
              €{earnings ? Number(earnings[period.amountKey]).toFixed(2) : "0.00"}
            </Text>
            <Text style={[styles.cardRides, { color: colors.bodyText }]}>
              {(earnings?.[period.ridesKey] as number) || 0} {t("earnings.rides")}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: staticColors.lightBg },
  content: { padding: spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md },
  emptyText: { fontSize: fonts.body, color: staticColors.bodyText },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: staticColors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: fonts.label, color: staticColors.bodyText, marginBottom: spacing.xs },
  cardAmount: { fontSize: 32, fontWeight: "bold", color: staticColors.dark },
  cardRides: { fontSize: fonts.caption, color: staticColors.bodyText, marginTop: 2 },
});
