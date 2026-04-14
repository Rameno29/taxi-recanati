/**
 * OSRM routing service — free, no API key required.
 * Returns driving route coordinates for displaying on the map.
 */

export interface RouteResult {
  coordinates: { latitude: number; longitude: number }[];
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Fetch a driving route between two points using OSRM.
 * Returns an array of coordinates for drawing a polyline on the map.
 */
export async function fetchRoute(
  pickupLat: number,
  pickupLng: number,
  destLat: number,
  destLng: number
): Promise<RouteResult | null> {
  try {
    // OSRM expects lng,lat order (opposite of most map libs)
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickupLng},${pickupLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      })
    );

    return {
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  }
}
