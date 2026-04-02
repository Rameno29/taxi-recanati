import { useEffect, useState } from "react";
import { api } from "../services/api";

interface Stats {
  rides: {
    pending: number;
    active: number;
    completed_today: number;
    revenue_today: number;
  };
  drivers: {
    total: number;
    online: number;
    busy: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    const res = await api.get("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  };

  if (!stats) return <p>Caricamento...</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={styles.grid}>
        <StatCard label="Corse in attesa" value={stats.rides.pending} color="#FF9800" />
        <StatCard label="Corse attive" value={stats.rides.active} color="#2196F3" />
        <StatCard label="Completate oggi" value={stats.rides.completed_today} color="#4CAF50" />
        <StatCard label="Ricavi oggi" value={`€${stats.rides.revenue_today.toFixed(2)}`} color="#1B5E20" />
        <StatCard label="Autisti totali" value={stats.drivers.total} color="#607D8B" />
        <StatCard label="Online" value={stats.drivers.online} color="#4CAF50" />
        <StatCard label="Occupati" value={stats.drivers.busy} color="#FF5722" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${color}` }}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
    marginTop: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardLabel: { fontSize: 13, color: "#666", marginBottom: 8 },
  cardValue: { fontSize: 28, fontWeight: "bold" },
};
