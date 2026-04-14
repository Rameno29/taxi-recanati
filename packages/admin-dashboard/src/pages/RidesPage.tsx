import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../services/api";
import { onRideStatus } from "../services/socket";

interface Ride {
  id: string;
  customer_name: string;
  customer_phone: string;
  driver_name: string | null;
  license_plate: string | null;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  status: string;
  fare_estimate: number;
  fare_final: number | null;
  type: string;
  created_at: string;
}

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface RouteData {
  coordinates: [number, number][];
  distanceKm: string;
  durationMin: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#FF9800",
  accepted: "#2196F3",
  arriving: "#9C27B0",
  in_progress: "#4CAF50",
  completed: "#607D8B",
  cancelled: "#F44336",
  expired: "#999",
  no_show: "#795548",
};

// Leaflet marker icons for the route map modal
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/**
 * Fetch driving route from OSRM (free, no API key).
 */
async function fetchOSRMRoute(
  pickupLat: number, pickupLng: number,
  destLat: number, destLng: number
): Promise<RouteData | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickupLng},${pickupLat};${destLng},${destLat}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    // GeoJSON coordinates are [lng, lat] — Leaflet wants [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return {
      coordinates,
      distanceKm: (route.distance / 1000).toFixed(1),
      durationMin: Math.round(route.duration / 60).toString(),
    };
  } catch {
    return null;
  }
}

export default function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [dispatchRideId, setDispatchRideId] = useState<string | null>(null);

  // Route map modal state
  const [mapRide, setMapRide] = useState<Ride | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    fetchRides();
  }, [page, statusFilter]);

  // Real-time: refresh rides list on any ride status change
  useEffect(() => {
    const off = onRideStatus(() => {
      fetchRides();
    });
    return () => { off?.(); };
  }, [page, statusFilter]);

  const fetchRides = async () => {
    let url = `/api/admin/rides?page=${page}&limit=20`;
    if (statusFilter) url += `&status=${statusFilter}`;
    const res = await api.get(url);
    if (res.ok) {
      const data = await res.json();
      setRides(data.rides);
      setTotal(data.total);
    }
  };

  const handleRefund = async (rideId: string) => {
    const amount = prompt("Importo rimborso (€):");
    if (amount === null) return;
    const body = amount ? { amount: Number(amount) } : {};
    const res = await api.post(`/api/admin/rides/${rideId}/refund`, body);
    if (res.ok) {
      alert("Rimborso effettuato");
      fetchRides();
    } else {
      const err = await res.json();
      alert(`Errore: ${err.message}`);
    }
  };

  const openDispatch = async (rideId: string) => {
    setDispatchRideId(rideId);
    const res = await api.get("/api/admin/drivers?status=available");
    if (res.ok) setAvailableDrivers(await res.json());
  };

  const dispatch = async (driverId: string) => {
    if (!dispatchRideId) return;
    const res = await api.post(`/api/admin/rides/${dispatchRideId}/dispatch`, { driverId });
    if (res.ok) {
      setDispatchRideId(null);
      fetchRides();
    }
  };

  // Open route map modal for a ride
  const openRouteMap = async (ride: Ride) => {
    setMapRide(ride);
    setRouteData(null);
    setRouteLoading(true);
    const route = await fetchOSRMRoute(
      Number(ride.pickup_lat), Number(ride.pickup_lng),
      Number(ride.destination_lat), Number(ride.destination_lng)
    );
    setRouteData(route);
    setRouteLoading(false);
  };

  const closeRouteMap = () => {
    setMapRide(null);
    setRouteData(null);
  };

  const statuses = ["", "pending", "accepted", "arriving", "in_progress", "completed", "cancelled"];

  return (
    <div>
      <h2 style={styles.pageTitle}>Corse <span style={styles.count}>({total})</span></h2>

      <div style={styles.filters}>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              ...styles.filterBtn,
              background: statusFilter === s ? "#4357AD" : "#fff",
              color: statusFilter === s ? "#fff" : "#555",
              border: statusFilter === s ? "1px solid #4357AD" : "1px solid #E0E0E0",
            }}
          >
            {s ? (
              <>
                <span style={{ ...styles.statusDot, background: STATUS_COLORS[s] || "#999" }} />
                {s}
              </>
            ) : "Tutte"}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Data</th>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Autista</th>
              <th style={styles.th}>Percorso</th>
              <th style={styles.th}>Stato</th>
              <th style={styles.th}>Tariffa</th>
              <th style={styles.th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFE" }}>
                <td style={{ ...styles.td, fontSize: 13, whiteSpace: "nowrap", color: "#666" }}>
                  {new Date(r.created_at).toLocaleDateString("it")}{" "}
                  {new Date(r.created_at).toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={styles.td}>
                  <strong style={{ color: "#1E2A5E" }}>{r.customer_name}</strong>
                  <br />
                  <small style={{ color: "#999" }}>{r.customer_phone}</small>
                </td>
                <td style={styles.td}>
                  {r.driver_name ? (
                    <>
                      <strong style={{ color: "#1E2A5E" }}>{r.driver_name}</strong>
                      <br />
                      <small style={{ color: "#999" }}>{r.license_plate}</small>
                    </>
                  ) : (
                    <span style={{ color: "#ccc" }}>—</span>
                  )}
                </td>
                <td style={{ ...styles.td, fontSize: 13, maxWidth: 220 }}>
                  <div title={r.pickup_address} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#333" }}>
                    {r.pickup_address || "—"}
                  </div>
                  <div title={r.destination_address} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#888" }}>
                    → {r.destination_address || "—"}
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: STATUS_COLORS[r.status] || "#999" }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ ...styles.td, fontWeight: 700, color: "#1E2A5E" }}>
                  €{Number(r.fare_final || r.fare_estimate).toFixed(2)}
                </td>
                <td style={{ ...styles.td }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {/* Map button — always visible */}
                    <button
                      style={{ ...styles.actionBtn, background: "#4357AD" }}
                      onClick={() => openRouteMap(r)}
                      title="Visualizza percorso"
                    >
                      🗺️ Mappa
                    </button>
                    {r.status === "pending" && !r.driver_name && (
                      <button style={styles.actionBtn} onClick={() => openDispatch(r.id)}>
                        Assegna
                      </button>
                    )}
                    {r.status === "completed" && (
                      <button
                        style={{ ...styles.actionBtn, background: "#F44336" }}
                        onClick={() => handleRefund(r.id)}
                      >
                        Rimborso
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={styles.pageBtn}>
          ← Indietro
        </button>
        <span style={{ color: "#666", fontSize: 14 }}>Pagina {page}</span>
        <button disabled={rides.length < 20} onClick={() => setPage(page + 1)} style={styles.pageBtn}>
          Avanti →
        </button>
      </div>

      {/* Dispatch modal */}
      {dispatchRideId && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: "0 0 16px", color: "#1E2A5E" }}>Assegna autista</h3>
            {availableDrivers.length === 0 ? (
              <p style={{ color: "#999" }}>Nessun autista disponibile</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {availableDrivers.map((d) => (
                  <button key={d.id} style={styles.driverBtn} onClick={() => dispatch(d.id)}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
            <button style={styles.cancelBtn} onClick={() => setDispatchRideId(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Route map modal */}
      {mapRide && (
        <div style={styles.overlay} onClick={closeRouteMap}>
          <div
            style={styles.mapModal}
            onClick={(e) => e.stopPropagation()} // prevent close on map click
          >
            <div style={styles.mapModalHeader}>
              <div>
                <h3 style={{ margin: 0, color: "#1E2A5E", fontSize: 18 }}>
                  Percorso corsa
                </h3>
                <p style={{ margin: "4px 0 0", color: "#888", fontSize: 13 }}>
                  {mapRide.customer_name} · {new Date(mapRide.created_at).toLocaleDateString("it")}
                  {routeData && (
                    <span style={{ marginLeft: 12, color: "#4357AD", fontWeight: 600 }}>
                      {routeData.distanceKm} km · ~{routeData.durationMin} min
                    </span>
                  )}
                </p>
              </div>
              <button style={styles.mapCloseBtn} onClick={closeRouteMap}>✕</button>
            </div>

            <div style={styles.mapAddresses}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...styles.addressDot, background: "#4CAF50" }} />
                <span style={{ fontSize: 13, color: "#333" }}>{mapRide.pickup_address || "Partenza"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ ...styles.addressDot, background: "#F44336" }} />
                <span style={{ fontSize: 13, color: "#333" }}>{mapRide.destination_address || "Destinazione"}</span>
              </div>
            </div>

            <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", position: "relative" }}>
              {routeLoading && (
                <div style={styles.mapLoading}>
                  <span>Caricamento percorso...</span>
                </div>
              )}
              <MapContainer
                center={[
                  (Number(mapRide.pickup_lat) + Number(mapRide.destination_lat)) / 2,
                  (Number(mapRide.pickup_lng) + Number(mapRide.destination_lng)) / 2,
                ]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                  position={[Number(mapRide.pickup_lat), Number(mapRide.pickup_lng)]}
                  icon={pickupIcon}
                >
                  <Popup>
                    <strong>Partenza</strong><br />
                    {mapRide.pickup_address}
                  </Popup>
                </Marker>
                <Marker
                  position={[Number(mapRide.destination_lat), Number(mapRide.destination_lng)]}
                  icon={destIcon}
                >
                  <Popup>
                    <strong>Destinazione</strong><br />
                    {mapRide.destination_address}
                  </Popup>
                </Marker>
                {routeData && routeData.coordinates.length >= 2 && (
                  <Polyline
                    positions={routeData.coordinates}
                    pathOptions={{ color: "#4357AD", weight: 5, opacity: 0.8 }}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", marginBottom: 20, marginTop: 0 },
  count: { fontWeight: 400, color: "#999", fontSize: 18 },
  filters: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  filterBtn: {
    padding: "7px 14px",
    borderRadius: 20,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  tableWrap: {
    background: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    color: "#888",
    background: "#F7F8FC",
    borderBottom: "1px solid #EBEDF5",
  },
  td: { padding: "12px 16px", borderBottom: "1px solid #F0F1F5", verticalAlign: "middle" },
  badge: {
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  },
  actionBtn: {
    padding: "6px 14px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
  },
  pageBtn: {
    padding: "8px 18px",
    background: "#fff",
    border: "1px solid #E0E0E0",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 13,
    color: "#4357AD",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(30,42,94,0.45)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    minWidth: 320,
    maxWidth: 420,
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  driverBtn: {
    padding: 12,
    background: "#EEF0FA",
    border: "1px solid #4357AD",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    color: "#4357AD",
  },
  cancelBtn: {
    marginTop: 16,
    padding: 12,
    background: "#F44336",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
    fontWeight: 600,
  },
  // Route map modal styles
  mapModal: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "90vw",
    maxWidth: 800,
    height: "80vh",
    maxHeight: 700,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
  },
  mapModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  mapCloseBtn: {
    background: "#F0F1F5",
    border: "none",
    borderRadius: 8,
    width: 36,
    height: 36,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    flexShrink: 0,
  },
  mapAddresses: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 12px",
    background: "#F7F8FC",
    borderRadius: 10,
    marginBottom: 12,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  mapLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255,255,255,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    fontSize: 14,
    color: "#666",
  },
};
