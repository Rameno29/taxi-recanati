import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { colors as staticColors, spacing, radii, shadows } from "../theme";
import { useThemeColors } from "../context/ThemeContext";
import type { Ride } from "../types";

export default function HistoryScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/rides/history?page=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setRides(p === 1 ? data.rides : [...rides, ...data.rides]);
        setTotalPages(data.totalPages);
        setPage(p);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory(1);
    }, [])
  );

  const renderRide = ({ item }: { item: Ride }) => {
    const date = new Date(item.created_at);
    const fare = item.fare_final || item.fare_estimate;

    return (
      <View style={[styles.card, { backgroundColor: colors.white }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.date, { color: colors.bodyText }]}>
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? colors.success : colors.error }]}>
            <Text style={styles.statusText}>{t(`ride.${item.status}` as any)}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <Ionicons name="location" size={16} color={colors.primaryBlue} />
          <Text style={[styles.address, { color: colors.dark }]} numberOfLines={1}>
            {item.pickup_address || `${Number(item.pickup_lat).toFixed(4)}, ${Number(item.pickup_lng).toFixed(4)}`}
          </Text>
        </View>
        <View style={styles.addressRow}>
          <Ionicons name="flag" size={16} color={colors.accentCoral} />
          <Text style={[styles.address, { color: colors.dark }]} numberOfLines={1}>
            {item.destination_address || `${Number(item.destination_lat).toFixed(4)}, ${Number(item.destination_lng).toFixed(4)}`}
          </Text>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.fare, { color: colors.dark }]}>€{Number(fare).toFixed(2)}</Text>

          {item.customer_rating && (
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= item.customer_rating! ? "star" : "star-outline"}
                  size={16}
                  color={star <= item.customer_rating! ? colors.accentCoral : colors.border}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.lightBg }}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        contentContainerStyle={styles.list}
        style={{ backgroundColor: colors.lightBg }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => fetchHistory(1)} tintColor={colors.primaryBlue} />
        }
        onEndReached={() => {
          if (page < totalPages && !loading) fetchHistory(page + 1);
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.bodyText }]}>{t("history.empty")}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60, gap: spacing.md },
  emptyText: { fontSize: 16, color: staticColors.bodyText },
  card: {
    backgroundColor: staticColors.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  date: { fontSize: 14, color: staticColors.bodyText },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusText: { color: staticColors.white, fontSize: 12, fontWeight: "bold" },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  address: { flex: 1, fontSize: 14, color: staticColors.dark },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: staticColors.border,
  },
  fare: { fontSize: 18, fontWeight: "bold", color: staticColors.dark },
  ratingRow: { flexDirection: "row", gap: 2 },
});
