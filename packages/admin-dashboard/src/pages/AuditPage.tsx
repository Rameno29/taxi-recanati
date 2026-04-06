import { useEffect, useState } from "react";
import { api } from "../services/api";

interface AuditAction {
  id: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  manual_dispatch: "#2196F3",
  refund: "#F44336",
  driver_update: "#FF9800",
  ride_cancel: "#795548",
};

const ACTION_BG: Record<string, string> = {
  manual_dispatch: "#E3F2FD",
  refund: "#FFEBEE",
  driver_update: "#FFF8E1",
  ride_cancel: "#EFEBE9",
};

export default function AuditPage() {
  const [actions, setActions] = useState<AuditAction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudit();
  }, [page, filter]);

  const fetchAudit = async () => {
    setLoading(true);
    let url = `/api/admin/audit?page=${page}&limit=30`;
    if (filter) url += `&action_type=${filter}`;
    const res = await api.get(url);
    if (res.ok) {
      const data = await res.json();
      setActions(data.actions);
      setTotal(data.total);
    }
    setLoading(false);
  };

  const actionTypes = ["", "manual_dispatch", "refund", "driver_update", "ride_cancel"];
  const actionLabels: Record<string, string> = {
    "": "Tutti",
    manual_dispatch: "Dispatch",
    refund: "Rimborso",
    driver_update: "Autista",
    ride_cancel: "Cancellazione",
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>Audit Log <span style={styles.count}>({total})</span></h2>

      <div style={styles.filters}>
        {actionTypes.map((t) => (
          <button
            key={t}
            onClick={() => { setFilter(t); setPage(1); }}
            style={{
              ...styles.filterBtn,
              background: filter === t ? "#4357AD" : "#fff",
              color: filter === t ? "#fff" : "#555",
              border: filter === t ? "1px solid #4357AD" : "1px solid #E0E0E0",
            }}
          >
            {actionLabels[t] || t}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Data</th>
              <th style={styles.th}>Admin</th>
              <th style={styles.th}>Azione</th>
              <th style={styles.th}>Target</th>
              <th style={styles.th}>Dettagli</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFE" }}>
                <td style={{ ...styles.td, fontSize: 13, whiteSpace: "nowrap", color: "#666" }}>
                  {new Date(a.created_at).toLocaleDateString("it")}{" "}
                  {new Date(a.created_at).toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={styles.td}>
                  <strong style={{ color: "#1E2A5E" }}>{a.admin_name || "System"}</strong>
                  {a.admin_email && <br />}
                  {a.admin_email && <small style={{ color: "#999" }}>{a.admin_email}</small>}
                </td>
                <td style={styles.td}>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    color: ACTION_COLORS[a.action_type] || "#607D8B",
                    background: ACTION_BG[a.action_type] || "#ECEFF1",
                    whiteSpace: "nowrap",
                  }}>
                    {a.action_type}
                  </span>
                </td>
                <td style={{ ...styles.td, fontSize: 13 }}>
                  <span style={{ color: "#555" }}>{a.target_type}</span>
                  <br />
                  <small style={{ color: "#bbb", fontFamily: "monospace" }}>
                    {a.target_id?.substring(0, 8)}...
                  </small>
                </td>
                <td style={{ ...styles.td, fontSize: 12, maxWidth: 320 }}>
                  {a.details ? (
                    <pre style={styles.details}>
                      {JSON.stringify(a.details, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ color: "#ccc" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions.length === 0 && !loading && (
        <p style={{ textAlign: "center", color: "#999", padding: 48, fontSize: 15 }}>
          Nessuna azione trovata
        </p>
      )}

      <div style={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={styles.pageBtn}>
          ← Indietro
        </button>
        <span style={{ color: "#666", fontSize: 14 }}>Pagina {page}</span>
        <button disabled={actions.length < 30} onClick={() => setPage(page + 1)} style={styles.pageBtn}>
          Avanti →
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", marginBottom: 20, marginTop: 0 },
  count: { fontWeight: 400, color: "#999", fontSize: 18 },
  filters: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  filterBtn: { padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 12 },
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
  details: {
    background: "#F7F8FC",
    padding: 10,
    borderRadius: 8,
    margin: 0,
    fontSize: 11,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: 80,
    overflow: "auto",
    color: "#555",
    border: "1px solid #EBEDF5",
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
};
