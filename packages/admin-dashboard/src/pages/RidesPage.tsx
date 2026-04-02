import { useEffect, useState } from "react";
import { api } from "../services/api";

interface Ride {
  id: string;
  customer_name: string;
  customer_phone: string;
  driver_name: string | null;
  license_plate: string | null;
  pickup_address: string;
  destination_address: string;
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

export default function RidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [dispatchRideId, setDispatchRideId] = useState<string | null>(null);

  useEffect(() => {
    fetchRides();
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

  const statuses = ["", "pending", "accepted", "arriving", "in_progress", "completed", "cancelled"];

  return (
    <div>
      <h2>Corse ({total})</h2>

      <div style={styles.filters}>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              ...styles.filterBtn,
              background: statusFilter === s ? "#1B5E20" : "#e0e0e0",
              color: statusFilter === s ? "#fff" : "#333",
            }}
          >
            {s || "Tutte"}
          </button>
        ))}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Autista</th>
            <th>Percorso</th>
            <th>Stato</th>
            <th>Tariffa</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rides.map((r) => (
            <tr key={r.id}>
              <td style={{ fontSize: 13 }}>
                {new Date(r.created_at).toLocaleDateString("it")}{" "}
                {new Date(r.created_at).toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" })}
              </td>
              <td>
                {r.customer_name}
                <br />
                <small style={{ color: "#999" }}>{r.customer_phone}</small>
              </td>
              <td>
                {r.driver_name ? (
                  <>
                    {r.driver_name}
                    <br />
                    <small style={{ color: "#999" }}>{r.license_plate}</small>
                  </>
                ) : (
                  <span style={{ color: "#999" }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 13, maxWidth: 200 }}>
                <div title={r.pickup_address} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.pickup_address || "—"}
                </div>
                <div title={r.destination_address} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#666" }}>
                  → {r.destination_address || "—"}
                </div>
              </td>
              <td>
                <span style={{ ...styles.badge, background: STATUS_COLORS[r.status] || "#999" }}>
                  {r.status}
                </span>
              </td>
              <td style={{ fontWeight: "bold" }}>
                €{Number(r.fare_final || r.fare_estimate).toFixed(2)}
              </td>
              <td>
                {r.status === "pending" && !r.driver_name && (
                  <button style={styles.actionBtn} onClick={() => openDispatch(r.id)}>
                    Assegna
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div style={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={styles.pageBtn}>
          ← Indietro
        </button>
        <span>Pagina {page}</span>
        <button disabled={rides.length < 20} onClick={() => setPage(page + 1)} style={styles.pageBtn}>
          Avanti →
        </button>
      </div>

      {/* Manual dispatch modal */}
      {dispatchRideId && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Assegna autista</h3>
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: {
    padding: "8px 14px",
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
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    marginTop: 20,
  },
  pageBtn: {
    padding: "8px 16px",
    background: "#e0e0e0",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
  },
  driverBtn: {
    padding: 12,
    background: "#E8F5E9",
    border: "1px solid #1B5E20",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 16,
    padding: 10,
    background: "#F44336",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    width: "100%",
    fontWeight: "bold",
  },
};
