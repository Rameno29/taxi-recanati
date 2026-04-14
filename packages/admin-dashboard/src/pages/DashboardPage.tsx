import { useEffect, useState } from "react";
import { api } from "../services/api";
import { onRideStatus, onDriverLocation, onDriverStatus } from "../services/socket";

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

const CARDS = [
  { key: "pending", label: "Corse in attesa", icon: "⏳", color: "#FF9800", bg: "#FFF8E1", path: "rides.pending" },
  { key: "active", label: "Corse attive", icon: "🚕", color: "#4357AD", bg: "#EEF0FA", path: "rides.active" },
  { key: "completed", label: "Completate oggi", icon: "✅", color: "#4CAF50", bg: "#E8F5E9", path: "rides.completed_today" },
  { key: "revenue", label: "Ricavi oggi", icon: "💰", color: "#F55D3E", bg: "#FFF0EE", path: "rides.revenue_today", format: "currency" },
  { key: "total_drivers", label: "Autisti totali", icon: "👥", color: "#607D8B", bg: "#ECEFF1", path: "drivers.total" },
  { key: "online", label: "Online", icon: "🟢", color: "#4CAF50", bg: "#E8F5E9", path: "drivers.online" },
  { key: "busy", label: "Occupati", icon: "🔴", color: "#FF5722", bg: "#FBE9E7", path: "drivers.busy" },
];

function getValue(stats: Stats, path: string): number {
  const [group, key] = path.split(".");
  return (stats as any)[group][key];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const fetchStats = async () => {
    const res = await api.get("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  };

  useEffect(() => {
    fetchStats();
    // Fallback polling every 30s (socket handles instant updates)
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time: re-fetch stats on any ride status change
  useEffect(() => {
    const offRide = onRideStatus((data) => {
      setLastEvent(`Corsa ${data.ride_id.slice(0, 8)}… → ${data.new_status}`);
      fetchStats(); // instant refresh
      // Clear event toast after 4s
      setTimeout(() => setLastEvent(null), 4000);
    });

    const offLocation = onDriverLocation(() => {
      // no-op for location pings — too frequent
    });

    // Refresh stats when driver goes online/offline/busy
    const offDriverStatus = onDriverStatus((data) => {
      setLastEvent(`Autista → ${data.status}`);
      fetchStats();
      setTimeout(() => setLastEvent(null), 4000);
    });

    return () => { offRide?.(); offLocation?.(); offDriverStatus?.(); };
  }, []);

  if (!stats)
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", color: "#999" }}>
        Caricamento...
      </div>
    );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={styles.pageTitle}>Dashboard</h2>
        {lastEvent && (
          <div style={styles.toast}>
            <span style={styles.toastDot} />
            {lastEvent}
          </div>
        )}
      </div>
      <div style={styles.grid}>
        {CARDS.map((card) => {
          const val = getValue(stats, card.path);
          return (
            <div key={card.key} style={{ ...styles.card, borderTop: `3px solid ${card.color}` }}>
              <div style={styles.cardHeader}>
                <span style={{ ...styles.cardIcon, background: card.bg }}>{card.icon}</span>
                <span style={styles.cardLabel}>{card.label}</span>
              </div>
              <div style={{ ...styles.cardValue, color: card.color }}>
                {card.format === "currency" ? `€${val.toFixed(2)}` : val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", marginBottom: 0, marginTop: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "20px 22px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  cardLabel: { fontSize: 13, color: "#888", fontWeight: 500 },
  cardValue: { fontSize: 32, fontWeight: 700 },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#E8F5E9",
    color: "#2E7D32",
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    animation: "fadeIn 0.3s ease",
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    background: "#4CAF50",
    animation: "pulse 1s infinite",
  },
};
