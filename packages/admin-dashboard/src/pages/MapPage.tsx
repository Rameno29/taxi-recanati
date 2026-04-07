import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../services/api";
import { onDriverLocation, onRideStatus } from "../services/socket";
import type { DriverLocationEvent } from "../services/socket";
import "leaflet/dist/leaflet.css";

interface DriverPosition {
  id: string;
  name: string;
  phone: string;
  status: string;
  current_lat: number;
  current_lng: number;
  vehicle_type: string;
  license_plate: string;
}

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const CENTER: [number, number] = [43.4034, 13.5498];

export default function MapPage() {
  const [drivers, setDrivers] = useState<DriverPosition[]>([]);
  const driversRef = useRef<DriverPosition[]>([]);

  const fetchPositions = async () => {
    const res = await api.get("/api/admin/drivers/positions");
    if (res.ok) {
      const data = await res.json();
      setDrivers(data);
      driversRef.current = data;
    }
  };

  useEffect(() => {
    fetchPositions();
    // Fallback polling every 30s (socket handles live updates)
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time: update driver positions on the map instantly
  useEffect(() => {
    const offLocation = onDriverLocation((data: DriverLocationEvent) => {
      setDrivers((prev) => {
        const updated = prev.map((d) =>
          d.id === data.driver_id
            ? { ...d, current_lat: data.lat, current_lng: data.lng }
            : d
        );
        driversRef.current = updated;
        return updated;
      });
    });

    // Ride status changes may toggle driver busy/available — full refresh
    const offRide = onRideStatus(() => {
      fetchPositions();
    });

    return () => { offLocation?.(); offRide?.(); };
  }, []);

  const available = drivers.filter((d) => d.status === "available").length;
  const busy = drivers.filter((d) => d.status !== "available").length;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Mappa autisti</h2>
        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: "#4CAF50" }} />
            Disponibili ({available})
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: "#F44336" }} />
            Occupati ({busy})
          </span>
          <span style={styles.liveIndicator}>
            <span style={styles.liveDot} />
            LIVE
          </span>
        </div>
      </div>
      <div style={styles.mapWrap}>
        <MapContainer center={CENTER} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {drivers.map((d) => (
            <Marker
              key={d.id}
              position={[d.current_lat, d.current_lng]}
              icon={d.status === "available" ? greenIcon : redIcon}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                {d.license_plate} — {d.vehicle_type}
                <br />
                <span style={{ color: d.status === "available" ? "#4CAF50" : "#F44336", fontWeight: 600 }}>
                  {d.status}
                </span>
                <br />
                {d.phone}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", margin: 0 },
  legend: { display: "flex", gap: 20, alignItems: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555", fontWeight: 500 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  liveIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontWeight: 700,
    color: "#F55D3E",
    background: "#FFF0EE",
    padding: "4px 12px",
    borderRadius: 20,
    letterSpacing: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: "#F55D3E",
    boxShadow: "0 0 0 2px rgba(245,93,62,0.3)",
  },
  mapWrap: {
    height: "calc(100vh - 180px)",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    border: "1px solid #E0E0E0",
  },
};
