import { useEffect, useState } from "react";
import { api } from "../services/api";

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

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchDrivers();
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

  return (
    <div>
      <h2>Autisti</h2>

      <div style={styles.filters}>
        {["", "available", "busy", "offline"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              ...styles.filterBtn,
              background: filter === s ? "#1B5E20" : "#e0e0e0",
              color: filter === s ? "#fff" : "#333",
            }}
          >
            {s || "Tutti"}
          </button>
        ))}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Telefono</th>
            <th>Targa</th>
            <th>Veicolo</th>
            <th>Stato</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id}>
              <td>
                <strong>{d.name}</strong>
                <br />
                <small style={{ color: "#999" }}>{d.email}</small>
              </td>
              <td>{d.phone}</td>
              <td>{d.license_plate}</td>
              <td>{d.vehicle_type}</td>
              <td>
                <span
                  style={{
                    ...styles.badge,
                    background: STATUS_COLORS[d.status] || "#999",
                  }}
                >
                  {d.status}
                </span>
              </td>
              <td>
                {d.status === "offline" && (
                  <button
                    style={styles.actionBtn}
                    onClick={() => updateStatus(d.id, "available")}
                  >
                    Attiva
                  </button>
                )}
                {d.status !== "offline" && d.status !== "busy" && (
                  <button
                    style={{ ...styles.actionBtn, background: "#F44336" }}
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

      {drivers.length === 0 && (
        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>
          Nessun autista trovato
        </p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: {
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 13,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  badge: {
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "bold",
  },
  actionBtn: {
    padding: "6px 12px",
    background: "#1B5E20",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
  },
};
