import { Outlet, NavLink } from "react-router-dom";
import { logout } from "../services/auth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/rides", label: "Corse", icon: "🚕" },
  { to: "/drivers", label: "Autisti", icon: "👤" },
  { to: "/map", label: "Mappa", icon: "🗺️" },
  { to: "/analytics", label: "Analytics", icon: "📈" },
  { to: "/audit", label: "Audit Log", icon: "📋" },
];

export default function Layout() {
  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>TR</div>
          <span style={styles.logoText}>Taxi Recanati</span>
          <span style={styles.logoSub}>Pannello Admin</span>
        </div>

        <div style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                ...styles.navLink,
                background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                borderLeft: isActive ? "3px solid #F55D3E" : "3px solid transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        <button onClick={logout} style={styles.logoutBtn}>
          Esci
        </button>
      </nav>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", minHeight: "100vh" },
  sidebar: {
    width: 240,
    background: "linear-gradient(180deg, #3A4DA0 0%, #2C3B7A 100%)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    padding: "0 0 16px",
    flexShrink: 0,
    boxShadow: "2px 0 12px rgba(0,0,0,0.15)",
  },
  logo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 16px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    marginBottom: 8,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#F55D3E",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1,
    marginBottom: 12,
  },
  logoText: { fontSize: 18, fontWeight: "bold", letterSpacing: 0.5 },
  logoSub: { fontSize: 11, opacity: 0.5, marginTop: 2, textTransform: "uppercase" as const, letterSpacing: 1.5 },
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1, padding: "8px 8px" },
  navLink: {
    textDecoration: "none",
    padding: "11px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 10,
    transition: "all 0.15s",
  },
  navIcon: { fontSize: 16, width: 24, textAlign: "center" },
  logoutBtn: {
    margin: "0 16px",
    padding: 12,
    background: "rgba(245, 93, 62, 0.15)",
    color: "#F55D3E",
    border: "1px solid rgba(245, 93, 62, 0.3)",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
  main: {
    flex: 1,
    padding: 32,
    background: "#F0F2F8",
    overflow: "auto",
  },
};
