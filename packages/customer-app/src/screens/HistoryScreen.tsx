import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import type { Ride } from "../types";

export default function HistoryScreen() {
  const { t } = useTranslation();
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" ? "#4CAF50" : "#F44336" }]}>
            <Text style={styles.statusText}>{t(`ride.${item.status}` as any)}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>
          📍 {item.pickup_address || `${item.pickup_lat.toFixed(4)}, ${item.pickup_lng.toFixed(4)}`}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          🏁 {item.destination_address || `${item.destination_lat.toFixed(4)}, ${item.destination_lng.toFixed(4)}`}
        </Text>

        <Text style={styles.fare}>€{Number(fare).toFixed(2)}</Text>

        {item.customer_rating && (
          <Text style={styles.rating}>
            {"★".repeat(item.customer_rating)}{"☆".repeat(5 - item.customer_rating)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={rides}
      keyExtractor={(item) => item.id}
      renderItem={renderRide}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => fetchHistory(1)} />
      }
      onEndReached={() => {
        if (page < totalPages && !loading) fetchHistory(page + 1);
      }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("history.empty")}</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 16, color: "#999" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  date: { fontSize: 14, color: "#666" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  address: { fontSize: 14, color: "#333", marginBottom: 4 },
  fare: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 8 },
  rating: { fontSize: 16, color: "#FFC107", marginTop: 4 },
});
