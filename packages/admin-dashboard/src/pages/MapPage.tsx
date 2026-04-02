import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../services/api";
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

// Fix default Leaflet marker icons
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

// Recanati center
const CENTER: [number, number] = [43.4034, 13.5498];

export default function MapPage() {
  const [drivers, setDrivers] = useState<DriverPosition[]>([]);

  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    const res = await api.get("/api/admin/drivers/positions");
    if (res.ok) setDrivers(await res.json());
  };

  return (
    <div>
      <h2>Mappa autisti ({drivers.length} attivi)</h2>
      <div style={{ height: "calc(100vh - 160px)", borderRadius: 12, overflow: "hidden" }}>
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
                <span style={{ color: d.status === "available" ? "green" : "red" }}>
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
