import { useEffect, useState } from "react";
import { api } from "../services/api";

interface Analytics {
  period: string;
  daily: { date: string; rides: number; revenue: number; avg_fare: number }[];
  totals: {
    rides: number;
    revenue: number;
    avg_fare: number;
    avg_distance_km: number;
    avg_duration_min: number;
  };
  by_status: Record<string, number>;
  by_vehicle: { vehicle_type: string; count: number; revenue: number }[];
  peak_hours: { hour: number; rides: number }[];
}

interface DriverPerf {
  driver_id: string;
  name: string;
  license_plate: string;
  vehicle_type: string;
  total_rides: number;
  total_revenue: number;
  avg_fare: number;
  avg_rating: number;
  rated_rides: number;
}

type Period = "week" | "month" | "year";

const STATUS_COLORS: Record<string, string> = {
  completed: "#4CAF50",
  cancelled: "#F44336",
  expired: "#999",
  no_show: "#795548",
  pending: "#FF9800",
  accepted: "#2196F3",
  arriving: "#9C27B0",
  in_progress: "#00BCD4",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [drivers, setDrivers] = useState<DriverPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [revRes, drvRes] = await Promise.all([
        api.get(`/api/admin/analytics/revenue?period=${period}`),
        api.get(`/api/admin/analytics/drivers?period=${period}`),
      ]);
      if (!revRes.ok) {
        const body = await revRes.json().catch(() => ({}));
        throw new Error(body.message || `Revenue API ${revRes.status}`);
      }
      if (!drvRes.ok) {
        const body = await drvRes.json().catch(() => ({}));
        throw new Error(body.message || `Drivers API ${drvRes.status}`);
      }
      setAnalytics(await revRes.json());
      setDrivers(await drvRes.json());
    } catch (e: any) {
      console.error("Analytics fetch failed:", e);
      setError(e.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const periodLabels: Record<Period, string> = {
    week: "Ultima settimana",
    month: "Ultimo mese",
    year: "Ultimo anno",
  };

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", color: "#999" }}>
        Caricamento...
      </div>
    );

  if (error || !analytics)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h3 style={{ color: "#F44336", marginBottom: 12 }}>Impossibile caricare le analytics</h3>
        <p style={{ color: "#666", marginBottom: 20 }}>{error || "Nessun dato disponibile"}</p>
        <button
          onClick={fetchData}
          style={{
            padding: "10px 24px",
            background: "#4357AD",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Riprova
        </button>
      </div>
    );

  const maxDailyRevenue = Math.max(...analytics.daily.map((d) => d.revenue), 1);

  const summaryCards = [
    { label: "Corse totali", value: analytics.totals.rides, icon: "🚕", color: "#4357AD" },
    { label: "Ricavi totali", value: `€${analytics.totals.revenue.toFixed(2)}`, icon: "💰", color: "#F55D3E" },
    { label: "Tariffa media", value: `€${analytics.totals.avg_fare.toFixed(2)}`, icon: "📊", color: "#FF9800" },
    { label: "Distanza media", value: `${analytics.totals.avg_distance_km} km`, icon: "📍", color: "#9C27B0" },
    { label: "Durata media", value: `${analytics.totals.avg_duration_min} min`, icon: "⏱️", color: "#607D8B" },
  ];

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>Analytics</h2>
        <div style={styles.periodSelector}>
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...styles.periodBtn,
                background: period === p ? "#4357AD" : "#fff",
                color: period === p ? "#fff" : "#555",
                border: period === p ? "1px solid #4357AD" : "1px solid #E0E0E0",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.grid}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ ...styles.card, borderTop: `3px solid ${card.color}` }}>
            <div style={styles.cardHeader}>
              <span style={styles.cardIconWrap}>{card.icon}</span>
              <span style={styles.cardLabel}>{card.label}</span>
            </div>
            <div style={{ ...styles.cardValue, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Ricavi giornalieri</h3>
        <div style={styles.chart}>
          {analytics.daily.map((d) => (
            <div key={d.date} style={styles.barCol}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(d.revenue / maxDailyRevenue) * 130}px`,
                }}
                title={`${d.date}: €${d.revenue.toFixed(2)} (${d.rides} corse)`}
              />
              <span style={styles.barLabel}>
                {new Date(d.date).toLocaleDateString("it", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status + vehicle side by side */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ ...styles.section, flex: 1, minWidth: 260 }}>
          <h3 style={styles.sectionTitle}>Corse per stato</h3>
          {Object.entries(analytics.by_status).map(([status, count]) => (
            <div key={status} style={styles.statusRow}>
              <span style={{ ...styles.statusDot, background: STATUS_COLORS[status] || "#999" }} />
              <span style={styles.statusLabel}>{status}</span>
              <span style={styles.statusCount}>{count}</span>
            </div>
          ))}
        </div>

        <div style={{ ...styles.section, flex: 1, minWidth: 260 }}>
          <h3 style={styles.sectionTitle}>Per tipo veicolo</h3>
          {analytics.by_vehicle.map((v) => (
            <div key={v.vehicle_type} style={styles.statusRow}>
              <span style={{ ...styles.statusLabel, textTransform: "capitalize" as const }}>{v.vehicle_type}</span>
              <span style={styles.statusCount}>{v.count} corse — €{v.revenue.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peak hours */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Ore di punta</h3>
        <div style={styles.peakGrid}>
          {analytics.peak_hours
            .sort((a, b) => a.hour - b.hour)
            .map((h) => {
              const intensity = Math.min(h.rides / Math.max(...analytics.peak_hours.map((p) => p.rides)), 1);
              return (
                <div
                  key={h.hour}
                  style={{
                    ...styles.peakCell,
                    background: `rgba(67, 87, 173, ${intensity * 0.85 + 0.1})`,
                  }}
                  title={`${h.rides} corse`}
                >
                  <span style={styles.peakHour}>{String(h.hour).padStart(2, "0")}:00</span>
                  <span style={styles.peakCount}>{h.rides}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Driver performance */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Performance autisti</h3>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Autista</th>
                <th style={styles.th}>Veicolo</th>
                <th style={styles.th}>Corse</th>
                <th style={styles.th}>Ricavi</th>
                <th style={styles.th}>Tariffa media</th>
                <th style={styles.th}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr key={d.driver_id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFE" }}>
                  <td style={styles.td}>
                    <strong style={{ color: "#1E2A5E" }}>{d.name}</strong>
                    <br />
                    <small style={{ color: "#999", fontFamily: "monospace" }}>{d.license_plate}</small>
                  </td>
                  <td style={{ ...styles.td, textTransform: "capitalize" as const, color: "#555" }}>{d.vehicle_type}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{d.total_rides}</td>
                  <td style={{ ...styles.td, fontWeight: 700, color: "#F55D3E" }}>€{d.total_revenue.toFixed(2)}</td>
                  <td style={{ ...styles.td, color: "#555" }}>€{d.avg_fare.toFixed(2)}</td>
                  <td style={styles.td}>
                    {d.avg_rating > 0 ? (
                      <span style={{ color: d.avg_rating >= 4 ? "#4CAF50" : d.avg_rating >= 3 ? "#FF9800" : "#F44336" }}>
                        {"★".repeat(Math.round(d.avg_rating))} {d.avg_rating.toFixed(1)}
                      </span>
                    ) : (
                      <span style={{ color: "#ccc" }}>—</span>
                    )}
                    {d.rated_rides > 0 && <small style={{ color: "#999" }}> ({d.rated_rides})</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 4 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", margin: 0 },
  periodSelector: { display: "flex", gap: 8 },
  periodBtn: { padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16, margin: "20px 0" },
  card: { background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  cardHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  cardIconWrap: { fontSize: 18 },
  cardLabel: { fontSize: 12, color: "#888", fontWeight: 500 },
  cardValue: { fontSize: 26, fontWeight: 700 },
  section: { background: "#fff", borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#1E2A5E", margin: "0 0 16px" },
  chart: { display: "flex", alignItems: "flex-end", gap: 4, height: 160, overflowX: "auto", paddingBottom: 4 },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 },
  bar: { width: 22, background: "linear-gradient(180deg, #4357AD 0%, #6B7ED6 100%)", borderRadius: "4px 4px 0 0", minHeight: 2 },
  barLabel: { fontSize: 9, color: "#999", marginTop: 4, whiteSpace: "nowrap" },
  statusRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F0F1F5" },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusLabel: { flex: 1, fontSize: 14, color: "#333" },
  statusCount: { fontSize: 14, fontWeight: 700, color: "#1E2A5E" },
  peakGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6 },
  peakCell: { borderRadius: 8, padding: 10, textAlign: "center", color: "#fff" },
  peakHour: { display: "block", fontSize: 12, fontWeight: 700 },
  peakCount: { display: "block", fontSize: 11, opacity: 0.9 },
  tableWrap: { borderRadius: 8, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    color: "#888",
    background: "#F7F8FC",
    borderBottom: "1px solid #EBEDF5",
  },
  td: { padding: "12px 16px", borderBottom: "1px solid #F0F1F5", verticalAlign: "middle" },
};
