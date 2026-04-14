import { useEffect, useState } from "react";
import { api } from "../services/api";
import { onRideStatus, onDriverLocation, onDriverStatus } from "../services/socket";

interface Driver {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  license_plate: string;
  vehicle_type: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#4CAF50",
  busy: "#FF5722",
  offline: "#999",
};

const STATUS_BG: Record<string, string> = {
  available: "#E8F5E9",
  busy: "#FBE9E7",
  offline: "#F5F5F5",
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  // Real-time: refresh on ride changes, driver status changes, and location updates
  useEffect(() => {
    const offRide = onRideStatus(() => { fetchDrivers(); });
    const offDriver = onDriverStatus(() => { fetchDrivers(); });
    const offLoc = onDriverLocation(() => { fetchDrivers(); });
    return () => { offRide?.(); offDriver?.(); offLoc?.(); };
  }, [filter]);

  const fetchDrivers = async () => {
    const url = filter ? `/api/admin/drivers?status=${filter}` : "/api/admin/drivers";
    const res = await api.get(url);
    if (res.ok) setDrivers(await res.json());
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await api.patch(`/api/admin/drivers/${id}`, { status });
    if (res.ok) fetchDrivers();
  };

  const filterLabels: Record<string, string> = { "": "Tutti", available: "Disponibili", busy: "Occupati", offline: "Offline" };

  return (
    <div>
      <h2 style={styles.pageTitle}>Autisti</h2>

      <div style={styles.filters}>
        {["", "available", "busy", "offline"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              ...styles.filterBtn,
              background: filter === s ? "#4357AD" : "#fff",
              color: filter === s ? "#fff" : "#555",
              border: filter === s ? "1px solid #4357AD" : "1px solid #E0E0E0",
            }}
          >
            {s && <span style={{ ...styles.statusDot, background: STATUS_COLORS[s] || "#999" }} />}
            {filterLabels[s]}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Nome</th>
              <th style={styles.th}>Telefono</th>
              <th style={styles.th}>Targa</th>
              <th style={styles.th}>Veicolo</th>
              <th style={styles.th}>Stato</th>
              <th style={styles.th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFE" }}>
                <td style={styles.td}>
                  <strong style={{ color: "#1E2A5E" }}>{d.name}</strong>
                  <br />
                  <small style={{ color: "#999" }}>{d.email}</small>
                </td>
                <td style={{ ...styles.td, color: "#555" }}>{d.phone}</td>
                <td style={{ ...styles.td, fontWeight: 600, color: "#1E2A5E", fontFamily: "monospace" }}>{d.license_plate}</td>
                <td style={{ ...styles.td, color: "#555", textTransform: "capitalize" as const }}>{d.vehicle_type}</td>
                <td style={styles.td}>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    color: STATUS_COLORS[d.status] || "#999",
                    background: STATUS_BG[d.status] || "#F5F5F5",
                  }}>
                    {d.status}
                  </span>
                </td>
                <td style={styles.td}>
                  {d.status === "offline" && (
                    <button style={styles.actionBtn} onClick={() => updateStatus(d.id, "available")}>
                      Attiva
                    </button>
                  )}
                  {d.status !== "offline" && d.status !== "busy" && (
                    <button
                      style={{ ...styles.actionBtn, background: "transparent", color: "#F44336", border: "1px solid #F44336" }}
                      onClick={() => updateStatus(d.id, "offline")}
                    >
                      Disattiva
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drivers.length === 0 && (
        <p style={{ textAlign: "center", color: "#999", padding: 48, fontSize: 15 }}>
          Nessun autista trovato
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", marginBottom: 20, marginTop: 0 },
  filters: { display: "flex", gap: 8, marginBottom: 20 },
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
  actionBtn: {
    padding: "6px 14px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
};
