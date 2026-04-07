import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth";
import { connectSocket } from "../services/socket";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      connectSocket(); // Connect WebSocket right after login
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>TR</div>
        </div>
        <h1 style={styles.title}>Taxi Recanati</h1>
        <p style={styles.subtitle}>Pannello Amministratore</p>

        {error && <div style={styles.error}>{error}</div>}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          placeholder="admin@taxirecanati.it"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        <label style={styles.label}>Password</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Accesso in corso..." : "Accedi"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #4357AD 0%, #2C3B7A 60%, #1E2A5E 100%)",
  },
  form: {
    background: "#fff",
    padding: "40px 36px 36px",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    width: 380,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  logoWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "#F55D3E",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 22,
    letterSpacing: 1,
  },
  title: { margin: 0, textAlign: "center", color: "#4357AD", fontSize: 26 },
  subtitle: { margin: "0 0 8px", textAlign: "center", color: "#999", fontSize: 13, letterSpacing: 0.5 },
  error: {
    background: "#FFF0EE",
    color: "#D32F2F",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    border: "1px solid #FFCDD2",
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#555",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #E0E0E0",
    borderRadius: 10,
    fontSize: 15,
    background: "#F7F8FC",
    outline: "none",
  },
  button: {
    marginTop: 8,
    padding: 14,
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: 0.5,
  },
};
