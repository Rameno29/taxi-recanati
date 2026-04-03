import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface MapPlaceholderProps {
  style?: any;
  children?: React.ReactNode;
  onPress?: (e: any) => void;
  markers?: { latitude: number; longitude: number; color: string; title: string }[];
}

export default function MapPlaceholder({ style, onPress, markers = [] }: MapPlaceholderProps) {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() =>
        onPress?.({
          nativeEvent: {
            coordinate: { latitude: 43.4034, longitude: 13.5498 },
          },
        })
      }
      activeOpacity={0.9}
    >
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.label}>Mappa (disponibile nella build nativa)</Text>
      {markers.map((m, i) => (
        <Text key={i} style={[styles.marker, { color: m.color }]}>
          📍 {m.title}: {m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}
        </Text>
      ))}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#e8f0fe",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  icon: { fontSize: 48, marginBottom: 8 },
  label: { fontSize: 14, color: "#666", marginBottom: 8 },
  marker: { fontSize: 13, marginTop: 4 },
});
