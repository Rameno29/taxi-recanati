import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth";

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
        <h1 style={styles.title}>Taxi Recanati</h1>
        <p style={styles.subtitle}>Admin Dashboard</p>

        {error && <div style={styles.error}>{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Loading..." : "Login"}
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
    background: "#f5f5f5",
  },
  form: {
    background: "#fff",
    padding: 40,
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    width: 360,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  title: { margin: 0, textAlign: "center", color: "#1B5E20" },
  subtitle: { margin: 0, textAlign: "center", color: "#666" },
  error: {
    background: "#FFEBEE",
    color: "#C62828",
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
  },
  input: {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    padding: 14,
    background: "#1B5E20",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
  },
};
