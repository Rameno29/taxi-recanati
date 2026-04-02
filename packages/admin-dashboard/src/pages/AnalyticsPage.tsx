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

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [drivers, setDrivers] = useState<DriverPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const [revRes, drvRes] = await Promise.all([
      api.get(`/api/admin/analytics/revenue?period=${period}`),
      api.get(`/api/admin/analytics/drivers?period=${period}`),
    ]);
    if (revRes.ok) setAnalytics(await revRes.json());
    if (drvRes.ok) setDrivers(await drvRes.json());
    setLoading(false);
  };

  const periodLabels: Record<Period, string> = {
    week: "Ultima settimana",
    month: "Ultimo mese",
    year: "Ultimo anno",
  };

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

  if (loading || !analytics) return <p>Caricamento...</p>;

  const maxDailyRevenue = Math.max(...analytics.daily.map((d) => d.revenue), 1);

  return (
    <div>
      <div style={styles.header}>
        <h2>Analytics</h2>
        <div style={styles.periodSelector}>
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                ...styles.periodBtn,
                background: period === p ? "#1B5E20" : "#e0e0e0",
                color: period === p ? "#fff" : "#333",
              }}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={styles.grid}>
        <SummaryCard label="Corse totali" value={analytics.totals.rides} color="#2196F3" />
        <SummaryCard label="Ricavi totali" value={`€${analytics.totals.revenue.toFixed(2)}`} color="#1B5E20" />
        <SummaryCard label="Tariffa media" value={`€${analytics.totals.avg_fare.toFixed(2)}`} color="#FF9800" />
        <SummaryCard label="Distanza media" value={`${analytics.totals.avg_distance_km} km`} color="#9C27B0" />
        <SummaryCard label="Durata media" value={`${analytics.totals.avg_duration_min} min`} color="#607D8B" />
      </div>

      {/* Revenue chart (simple bar chart) */}
      <div style={styles.section}>
        <h3>Ricavi giornalieri</h3>
        <div style={styles.chart}>
          {analytics.daily.map((d) => (
            <div key={d.date} style={styles.barCol}>
              <div
                style={{
                  ...styles.bar,
                  height: `${(d.revenue / maxDailyRevenue) * 120}px`,
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

      {/* Status breakdown + vehicle breakdown side by side */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ ...styles.section, flex: 1, minWidth: 250 }}>
          <h3>Corse per stato</h3>
          {Object.entries(analytics.by_status).map(([status, count]) => (
            <div key={status} style={styles.statusRow}>
              <span style={{ ...styles.statusDot, background: STATUS_COLORS[status] || "#999" }} />
              <span style={styles.statusLabel}>{status}</span>
              <span style={styles.statusCount}>{count}</span>
            </div>
          ))}
        </div>

        <div style={{ ...styles.section, flex: 1, minWidth: 250 }}>
          <h3>Per tipo veicolo</h3>
          {analytics.by_vehicle.map((v) => (
            <div key={v.vehicle_type} style={styles.statusRow}>
              <span style={styles.statusLabel}>{v.vehicle_type}</span>
              <span style={styles.statusCount}>{v.count} corse — €{v.revenue.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peak hours */}
      <div style={styles.section}>
        <h3>Ore di punta</h3>
        <div style={styles.peakGrid}>
          {analytics.peak_hours
            .sort((a, b) => a.hour - b.hour)
            .map((h) => (
              <div
                key={h.hour}
                style={{
                  ...styles.peakCell,
                  background: `rgba(27, 94, 32, ${Math.min(h.rides / Math.max(...analytics.peak_hours.map((p) => p.rides)), 1) * 0.8 + 0.1})`,
                }}
                title={`${h.rides} corse`}
              >
                <span style={styles.peakHour}>{String(h.hour).padStart(2, "0")}:00</span>
                <span style={styles.peakCount}>{h.rides}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Driver performance table */}
      <div style={styles.section}>
        <h3>Performance autisti</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Autista</th>
              <th>Veicolo</th>
              <th>Corse</th>
              <th>Ricavi</th>
              <th>Tariffa media</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.driver_id}>
                <td>
                  <strong>{d.name}</strong>
                  <br />
                  <small style={{ color: "#999" }}>{d.license_plate}</small>
                </td>
                <td>{d.vehicle_type}</td>
                <td>{d.total_rides}</td>
                <td style={{ fontWeight: "bold", color: "#1B5E20" }}>€{d.total_revenue.toFixed(2)}</td>
                <td>€{d.avg_fare.toFixed(2)}</td>
                <td>
                  {d.avg_rating > 0 ? (
                    <span style={{ color: d.avg_rating >= 4 ? "#4CAF50" : d.avg_rating >= 3 ? "#FF9800" : "#F44336" }}>
                      {"★".repeat(Math.round(d.avg_rating))} {d.avg_rating.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ color: "#999" }}>—</span>
                  )}
                  {d.rated_rides > 0 && (
                    <small style={{ color: "#999" }}> ({d.rated_rides})</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${color}` }}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  periodSelector: { display: "flex", gap: 8 },
  periodBtn: { padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, margin: "16px 0" },
  card: { background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  cardLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  cardValue: { fontSize: 24, fontWeight: "bold" },
  section: { background: "#fff", borderRadius: 8, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  chart: { display: "flex", alignItems: "flex-end", gap: 4, height: 150, overflowX: "auto", paddingBottom: 4 },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 28 },
  bar: { width: 20, background: "#1B5E20", borderRadius: "4px 4px 0 0", minHeight: 2 },
  barLabel: { fontSize: 9, color: "#999", marginTop: 4, whiteSpace: "nowrap" },
  statusRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f0f0" },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  statusLabel: { flex: 1, fontSize: 14, color: "#333" },
  statusCount: { fontSize: 14, fontWeight: "bold", color: "#333" },
  peakGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 6 },
  peakCell: { borderRadius: 6, padding: 8, textAlign: "center", color: "#fff" },
  peakHour: { display: "block", fontSize: 12, fontWeight: "bold" },
  peakCount: { display: "block", fontSize: 11, opacity: 0.9 },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 12 },
};
