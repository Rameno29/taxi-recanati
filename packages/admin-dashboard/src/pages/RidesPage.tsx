import { useEffect, useState, useCallback } from "react";
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
    const amount = prompt("Importo rimborso in centesimi (vuoto = rimborso totale):");
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
                <td style={{ ...styles.td, display: "flex", gap: 6 }}>
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
};
