import React, { useRef, useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { colors } from "../theme";

interface MarkerData {
  coordinate: { latitude: number; longitude: number };
  title: string;
  color: string;
}

interface LiveMapProps {
  initialRegion?: Region;
  markers?: MarkerData[];
  driverLocation?: { latitude: number; longitude: number } | null;
  showUserLocation?: boolean;
  onPress?: (e: any) => void;
  style?: ViewStyle;
}

const RECANATI_REGION: Region = {
  latitude: 43.4034,
  longitude: 13.5498,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function LiveMap({
  initialRegion,
  markers = [],
  driverLocation,
  showUserLocation = false,
  onPress,
  style,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!driverLocation || !mapRef.current) return;

    const coords = markers.map((m) => m.coordinate);
    coords.push(driverLocation);

    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    } else {
      mapRef.current.animateToRegion(
        {
          ...driverLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      initialRegion={initialRegion ?? RECANATI_REGION}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={showUserLocation}
      onPress={onPress}
    >
      {markers.map((m, i) => (
        <Marker
          key={`marker-${i}`}
          coordinate={m.coordinate}
          title={m.title}
          pinColor={m.color}
        />
      ))}
      {driverLocation && (
        <Marker
          coordinate={driverLocation}
          title="Driver"
          pinColor={colors.primaryBlue}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
