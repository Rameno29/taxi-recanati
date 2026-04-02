import { Outlet, NavLink } from "react-router-dom";
import { logout } from "../services/auth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/rides", label: "Corse" },
  { to: "/drivers", label: "Autisti" },
  { to: "/map", label: "Mappa" },
];

export default function Layout() {
  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoText}>Taxi Recanati</span>
          <span style={styles.logoSub}>Admin</span>
        </div>

        <div style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              style={({ isActive }) => ({
                ...styles.navLink,
                background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
              })}
            >
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
    width: 220,
    background: "#1B5E20",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    padding: 16,
    flexShrink: 0,
  },
  logo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 0 24px",
    borderBottom: "1px solid rgba(255,255,255,0.2)",
    marginBottom: 16,
  },
  logoText: { fontSize: 18, fontWeight: "bold" },
  logoSub: { fontSize: 12, opacity: 0.7 },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navLink: {
    color: "#fff",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
  },
  logoutBtn: {
    padding: 12,
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: "bold",
  },
  main: {
    flex: 1,
    padding: 24,
    background: "#f5f5f5",
    overflow: "auto",
  },
};
