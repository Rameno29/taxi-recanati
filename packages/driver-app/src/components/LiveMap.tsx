import React, { useRef, useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
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
  routeCoordinates?: { latitude: number; longitude: number }[];
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
  routeCoordinates,
  showUserLocation = false,
  onPress,
  style,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);

  // Fit map to show route, markers, and driver
  useEffect(() => {
    if (!mapRef.current) return;

    const allCoords: { latitude: number; longitude: number }[] = [];

    markers.forEach((m) => allCoords.push(m.coordinate));
    if (driverLocation) allCoords.push(driverLocation);
    if (routeCoordinates && routeCoordinates.length >= 2) {
      allCoords.push(routeCoordinates[0]);
      allCoords.push(routeCoordinates[routeCoordinates.length - 1]);
    }

    if (allCoords.length >= 2) {
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 80, right: 60, bottom: 200, left: 60 },
        animated: true,
      });
    }
  }, [
    driverLocation?.latitude,
    driverLocation?.longitude,
    routeCoordinates?.length,
    markers.length,
  ]);

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      initialRegion={initialRegion ?? RECANATI_REGION}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={showUserLocation}
      onPress={onPress}
    >
      {routeCoordinates && routeCoordinates.length >= 2 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={colors.primaryBlue}
          strokeWidth={4}
        />
      )}

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
