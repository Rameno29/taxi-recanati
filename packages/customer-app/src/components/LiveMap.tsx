import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Text, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { useTheme } from "../context/ThemeContext";

interface MarkerData {
  coordinate: { latitude: number; longitude: number };
  title: string;
  color: string;
}

interface NearbyDriver {
  lat: number;
  lng: number;
  vehicle_type: string;
}

interface LiveMapProps {
  initialRegion?: Region;
  markers?: MarkerData[];
  driverLocation?: { latitude: number; longitude: number } | null;
  routeCoordinates?: { latitude: number; longitude: number }[];
  nearbyDrivers?: NearbyDriver[];
  showUserLocation?: boolean;
  /** Animate the camera to this point once when it first becomes available
   *  (e.g. user's GPS fix on app open). Subsequent changes are ignored to
   *  avoid hijacking the camera from the user. */
  centerOnFirstFix?: { latitude: number; longitude: number } | null;
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
  nearbyDrivers = [],
  showUserLocation = false,
  centerOnFirstFix,
  onPress,
  style,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnUser = useRef(false);
  const { isDark } = useTheme();
  // Brighter, higher-contrast color for dark maps; brand blue for light maps
  const routeColor = isDark ? "#40C4FF" : colors.primaryBlue;
  const driverPinColor = isDark ? "#40C4FF" : colors.primaryBlue;

  // One-shot: center the camera on the user's first GPS fix.
  useEffect(() => {
    if (!centerOnFirstFix || hasCenteredOnUser.current) return;
    if (!mapRef.current) return;
    hasCenteredOnUser.current = true;
    mapRef.current.animateCamera(
      {
        center: centerOnFirstFix,
        zoom: 16,
        pitch: 0,
        heading: 0,
        altitude: 1000,
      },
      { duration: 600 }
    );
  }, [centerOnFirstFix?.latitude, centerOnFirstFix?.longitude]);

  // Fit map to show route, markers, and driver
  useEffect(() => {
    if (!mapRef.current) return;

    const allCoords: { latitude: number; longitude: number }[] = [];

    // Add marker coordinates
    markers.forEach((m) => allCoords.push(m.coordinate));

    // Add driver location
    if (driverLocation) allCoords.push(driverLocation);

    // Add route endpoints (first and last) for bounds
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
      // Native blue dot with heading arrow (iOS/Android Google Maps)
      showsCompass={true}
      // iOS: rotate dot with the device compass when GPS heading is unknown
      userLocationPriority="high"
      userLocationUpdateInterval={2000}
      userLocationFastestInterval={1000}
      onPress={onPress}
    >
      {/* Route polyline */}
      {routeCoordinates && routeCoordinates.length >= 2 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={routeColor}
          strokeWidth={5}
          lineDashPattern={undefined}
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
          pinColor={driverPinColor}
        />
      )}

      {/* Nearby available drivers — small car icons, no PII. Skipped when a
          specific driverLocation (active ride) is set to avoid clutter. */}
      {!driverLocation &&
        nearbyDrivers.map((d, i) => (
          <Marker
            key={`nearby-${i}-${d.lat}-${d.lng}`}
            coordinate={{ latitude: d.lat, longitude: d.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.nearbyPin}>
              <Ionicons name="car" size={16} color="#FFF" />
            </View>
          </Marker>
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  nearbyPin: {
    backgroundColor: colors.primaryBlue,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
});
