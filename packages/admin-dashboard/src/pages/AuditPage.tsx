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

  const ACTION_COLORS: Record<string, string> = {
    manual_dispatch: "#2196F3",
    refund: "#F44336",
    driver_update: "#FF9800",
    ride_cancel: "#795548",
  };

  const actionTypes = ["", "manual_dispatch", "refund", "driver_update", "ride_cancel"];

  return (
    <div>
      <h2>Audit Log ({total})</h2>

      <div style={styles.filters}>
        {actionTypes.map((t) => (
          <button
            key={t}
            onClick={() => { setFilter(t); setPage(1); }}
            style={{
              ...styles.filterBtn,
              background: filter === t ? "#1B5E20" : "#e0e0e0",
              color: filter === t ? "#fff" : "#333",
            }}
          >
            {t || "Tutti"}
          </button>
        ))}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Admin</th>
            <th>Azione</th>
            <th>Target</th>
            <th>Dettagli</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id}>
              <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                {new Date(a.created_at).toLocaleDateString("it")}{" "}
                {new Date(a.created_at).toLocaleTimeString("it", { hour: "2-digit", minute: "2-digit" })}
              </td>
              <td>
                {a.admin_name || "System"}
                {a.admin_email && <br />}
                {a.admin_email && <small style={{ color: "#999" }}>{a.admin_email}</small>}
              </td>
              <td>
                <span
                  style={{
                    ...styles.badge,
                    background: ACTION_COLORS[a.action_type] || "#607D8B",
                  }}
                >
                  {a.action_type}
                </span>
              </td>
              <td style={{ fontSize: 13 }}>
                {a.target_type}
                <br />
                <small style={{ color: "#999", fontFamily: "monospace" }}>
                  {a.target_id?.substring(0, 8)}...
                </small>
              </td>
              <td style={{ fontSize: 12, maxWidth: 300 }}>
                {a.details ? (
                  <pre style={styles.details}>
                    {JSON.stringify(a.details, null, 2)}
                  </pre>
                ) : (
                  <span style={{ color: "#999" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {actions.length === 0 && !loading && (
        <p style={{ textAlign: "center", color: "#999", padding: 40 }}>
          Nessuna azione trovata
        </p>
      )}

      <div style={styles.pagination}>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={styles.pageBtn}>
          ← Indietro
        </button>
        <span>Pagina {page}</span>
        <button disabled={actions.length < 30} onClick={() => setPage(page + 1)} style={styles.pageBtn}>
          Avanti →
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: { padding: "8px 14px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 13 },
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
    fontSize: 11,
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  details: {
    background: "#f5f5f5",
    padding: 8,
    borderRadius: 6,
    margin: 0,
    fontSize: 11,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    maxHeight: 80,
    overflow: "auto",
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
};
