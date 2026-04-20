import { useEffect, useState } from "react";
import { api } from "../services/api";
import { onRideStatus, onDriverLocation, onDriverStatus } from "../services/socket";

interface Driver {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_model: string | null;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#4CAF50",
  busy: "#FF5722",
  offline: "#999",
};

const STATUS_BG: Record<string, string> = {
  available: "#E8F5E9",
  busy: "#FBE9E7",
  offline: "#F5F5F5",
};

const VEHICLE_TYPES = ["standard", "monovolume", "premium", "van"] as const;
const EMAIL_DOMAIN = "@taxirecanati.it";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState("");

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [passwordReveal, setPasswordReveal] = useState<{ password: string; driverName: string } | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, [filter]);

  // Real-time: refresh on ride changes, driver status changes, and location updates
  useEffect(() => {
    const offRide = onRideStatus(() => { fetchDrivers(); });
    const offDriver = onDriverStatus(() => { fetchDrivers(); });
    const offLoc = onDriverLocation(() => { fetchDrivers(); });
    return () => { offRide?.(); offDriver?.(); offLoc?.(); };
  }, [filter]);

  const fetchDrivers = async () => {
    const url = filter ? `/api/admin/drivers?status=${filter}` : "/api/admin/drivers";
    const res = await api.get(url);
    if (res.ok) setDrivers(await res.json());
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await api.patch(`/api/admin/drivers/${id}`, { status });
    if (res.ok) fetchDrivers();
  };

  const filterLabels: Record<string, string> = { "": "Tutti", available: "Disponibili", busy: "Occupati", offline: "Offline" };

  return (
    <div>
      <div style={styles.headerRow}>
        <h2 style={styles.pageTitle}>Autisti</h2>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>+ Nuovo Autista</button>
      </div>

      <div style={styles.filters}>
        {["", "available", "busy", "offline"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              ...styles.filterBtn,
              background: filter === s ? "#4357AD" : "#fff",
              color: filter === s ? "#fff" : "#555",
              border: filter === s ? "1px solid #4357AD" : "1px solid #E0E0E0",
            }}
          >
            {s && <span style={{ ...styles.statusDot, background: STATUS_COLORS[s] || "#999" }} />}
            {filterLabels[s]}
          </button>
        ))}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Nome</th>
              <th style={styles.th}>Telefono</th>
              <th style={styles.th}>Targa</th>
              <th style={styles.th}>Veicolo</th>
              <th style={styles.th}>Stato</th>
              <th style={styles.th}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFBFE" }}>
                <td style={styles.td}>
                  <strong style={{ color: "#1E2A5E" }}>{d.name}</strong>
                  <br />
                  <small style={{ color: "#999" }}>{d.email}</small>
                </td>
                <td style={{ ...styles.td, color: "#555" }}>{d.phone}</td>
                <td style={{ ...styles.td, fontWeight: 600, color: "#1E2A5E", fontFamily: "monospace" }}>{d.license_plate}</td>
                <td style={{ ...styles.td, color: "#555" }}>
                  <span style={{ textTransform: "capitalize" }}>{d.vehicle_type}</span>
                  {d.vehicle_model && <><br /><small style={{ color: "#999" }}>{d.vehicle_model}</small></>}
                </td>
                <td style={styles.td}>
                  <span style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    color: STATUS_COLORS[d.status] || "#999",
                    background: STATUS_BG[d.status] || "#F5F5F5",
                  }}>
                    {d.status}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={styles.actionBtn} onClick={() => setEditing(d)}>
                      Modifica
                    </button>
                    {d.status === "offline" && (
                      <button style={{ ...styles.actionBtn, background: "#4CAF50" }} onClick={() => updateStatus(d.id, "available")}>
                        Attiva
                      </button>
                    )}
                    {d.status !== "offline" && d.status !== "busy" && (
                      <button
                        style={{ ...styles.actionBtn, background: "transparent", color: "#F44336", border: "1px solid #F44336" }}
                        onClick={() => updateStatus(d.id, "offline")}
                      >
                        Disattiva
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drivers.length === 0 && (
        <p style={{ textAlign: "center", color: "#999", padding: 48, fontSize: 15 }}>
          Nessun autista trovato
        </p>
      )}

      {showCreate && (
        <CreateDriverModal
          onClose={() => setShowCreate(false)}
          onCreated={(tempPassword, name) => {
            setShowCreate(false);
            setPasswordReveal({ password: tempPassword, driverName: name });
            fetchDrivers();
          }}
        />
      )}

      {editing && (
        <EditDriverModal
          driver={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchDrivers();
          }}
          onPasswordReset={(tempPassword, name) => {
            setEditing(null);
            setPasswordReveal({ password: tempPassword, driverName: name });
          }}
        />
      )}

      {passwordReveal && (
        <PasswordRevealModal
          password={passwordReveal.password}
          driverName={passwordReveal.driverName}
          onClose={() => setPasswordReveal(null)}
        />
      )}
    </div>
  );
}

// ── Create driver modal ─────────────────────────────────────────────────

function CreateDriverModal({ onClose, onCreated }: { onClose: () => void; onCreated: (pw: string, name: string) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("+39");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("standard");
  const [vehicleModel, setVehicleModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      const payload = {
        name,
        phone: phone.trim(),
        email: `${emailPrefix.trim().toLowerCase()}${EMAIL_DOMAIN}`,
        license_plate: licensePlate.trim().toUpperCase(),
        vehicle_type: vehicleType,
        vehicle_model: vehicleModel.trim() || null,
      };
      const res = await api.post("/api/admin/drivers", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Errore sconosciuto" }));
        throw new Error(err.message || "Creazione fallita");
      }
      const data = await res.json();
      onCreated(data.tempPassword, data.driver.name);
    } catch (err: any) {
      setError(err.message || "Errore");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Nuovo Autista" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={styles.row2}>
          <Field label="Nome" value={firstName} onChange={setFirstName} required />
          <Field label="Cognome" value={lastName} onChange={setLastName} required />
        </div>
        <Field label="Telefono (es. +393271234567)" value={phone} onChange={setPhone} required />
        <div style={styles.emailRow}>
          <label style={styles.label}>Email</label>
          <div style={styles.emailInputWrap}>
            <input
              style={{ ...styles.input, borderRight: "none", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              value={emailPrefix}
              onChange={(e) => setEmailPrefix(e.target.value)}
              placeholder="nome.cognome"
              required
            />
            <span style={styles.emailSuffix}>{EMAIL_DOMAIN}</span>
          </div>
        </div>
        <Field label="Targa" value={licensePlate} onChange={(v) => setLicensePlate(v.toUpperCase())} required />
        <div style={styles.row2}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Tipo veicolo</label>
            <select style={styles.input} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <Field label="Modello veicolo" value={vehicleModel} onChange={setVehicleModel} placeholder="Es. Fiat 500L" />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={submitting}>Annulla</button>
          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting ? "Creazione..." : "Crea Autista"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Edit driver modal ───────────────────────────────────────────────────

function EditDriverModal({
  driver,
  onClose,
  onSaved,
  onPasswordReset,
}: {
  driver: Driver;
  onClose: () => void;
  onSaved: () => void;
  onPasswordReset: (pw: string, name: string) => void;
}) {
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [email, setEmail] = useState(driver.email);
  const [vehicleModel, setVehicleModel] = useState(driver.vehicle_model || "");
  const [licensePlate, setLicensePlate] = useState(driver.license_plate);
  const [vehicleType, setVehicleType] = useState(driver.vehicle_type);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Details endpoint: name, phone, email, vehicle_model
      const detailsPayload: Record<string, any> = {};
      if (name !== driver.name) detailsPayload.name = name.trim();
      if (phone !== driver.phone) detailsPayload.phone = phone.trim();
      if (email !== driver.email) detailsPayload.email = email.trim();
      if (vehicleModel !== (driver.vehicle_model || "")) detailsPayload.vehicle_model = vehicleModel.trim() || null;

      if (Object.keys(detailsPayload).length > 0) {
        const r1 = await api.patch(`/api/admin/drivers/${driver.id}/details`, detailsPayload);
        if (!r1.ok) {
          const err = await r1.json().catch(() => ({ message: "Errore" }));
          throw new Error(err.message);
        }
      }

      // Main endpoint: license_plate, vehicle_type
      const mainPayload: Record<string, any> = {};
      if (licensePlate !== driver.license_plate) mainPayload.license_plate = licensePlate.trim().toUpperCase();
      if (vehicleType !== driver.vehicle_type) mainPayload.vehicle_type = vehicleType;

      if (Object.keys(mainPayload).length > 0) {
        const r2 = await api.patch(`/api/admin/drivers/${driver.id}`, mainPayload);
        if (!r2.ok) {
          const err = await r2.json().catch(() => ({ message: "Errore" }));
          throw new Error(err.message);
        }
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || "Errore");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(`Rigenerare la password per ${driver.name}? La password attuale diventerà inutilizzabile.`)) return;
    setResetting(true);
    setError(null);
    try {
      const res = await api.post(`/api/admin/drivers/${driver.id}/reset-password`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Errore" }));
        throw new Error(err.message);
      }
      const data = await res.json();
      onPasswordReset(data.tempPassword, driver.name);
    } catch (err: any) {
      setError(err.message || "Errore");
    } finally {
      setResetting(false);
    }
  };

  return (
    <ModalShell title={`Modifica ${driver.name}`} onClose={onClose}>
      <form onSubmit={handleSave}>
        <Field label="Nome e Cognome" value={name} onChange={setName} required />
        <Field label="Telefono" value={phone} onChange={setPhone} required />
        <Field label="Email" value={email} onChange={setEmail} required />
        <Field label="Targa" value={licensePlate} onChange={(v) => setLicensePlate(v.toUpperCase())} required />
        <div style={styles.row2}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Tipo veicolo</label>
            <select style={styles.input} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <Field label="Modello veicolo" value={vehicleModel} onChange={setVehicleModel} />
        </div>

        <div style={styles.resetBox}>
          <div>
            <strong style={{ color: "#1E2A5E" }}>Password</strong>
            <p style={styles.resetHint}>
              Per sicurezza la password non può essere visualizzata. Se il driver l'ha dimenticata, rigenerala.
            </p>
          </div>
          <button type="button" style={styles.resetBtn} onClick={handleResetPassword} disabled={resetting}>
            {resetting ? "..." : "Rigenera password"}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={saving}>Annulla</button>
          <button type="submit" style={styles.submitBtn} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Password reveal modal ───────────────────────────────────────────────

function PasswordRevealModal({
  password,
  driverName,
  onClose,
}: {
  password: string;
  driverName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <ModalShell title="Password generata" onClose={onClose}>
      <div style={styles.warningBanner}>
        ⚠ Questa password non sarà più visibile dopo la chiusura. Copiala ora e consegnala al driver.
      </div>
      <p style={{ color: "#555", marginTop: 16, marginBottom: 8 }}>
        Credenziali per <strong>{driverName}</strong>:
      </p>
      <div style={styles.passwordDisplay}>
        <code style={styles.passwordText}>{password}</code>
        <button type="button" style={styles.copyBtn} onClick={handleCopy}>
          {copied ? "✓ Copiata" : "Copia"}
        </button>
      </div>
      <div style={styles.modalActions}>
        <button type="button" style={styles.submitBtn} onClick={onClose}>Ho copiato la password</button>
      </div>
    </ModalShell>
  );
}

// ── Reusable bits ───────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0, color: "#1E2A5E" }}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div style={{ flex: 1, marginBottom: 14 }}>
      <label style={styles.label}>{label}{required && <span style={{ color: "#F44336" }}> *</span>}</label>
      <input
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1E2A5E", margin: 0 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  newBtn: {
    padding: "10px 18px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  filters: { display: "flex", gap: 8, marginBottom: 20 },
  filterBtn: {
    padding: "7px 14px",
    borderRadius: 20,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
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
  actionBtn: {
    padding: "6px 14px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  // Modal
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    width: 520,
    maxWidth: "92vw",
    maxHeight: "92vh",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #EBEDF5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: "#999",
    width: 32,
    height: 32,
    borderRadius: 4,
    lineHeight: 1,
  },
  row2: { display: "flex", gap: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #E0E0E0",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  emailRow: { marginBottom: 14 },
  emailInputWrap: { display: "flex", alignItems: "stretch" },
  emailSuffix: {
    padding: "8px 12px",
    background: "#F5F5F7",
    border: "1px solid #E0E0E0",
    borderLeft: "none",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    color: "#555",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #F0F1F5",
  },
  cancelBtn: {
    padding: "10px 18px",
    background: "#fff",
    color: "#555",
    border: "1px solid #E0E0E0",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  submitBtn: {
    padding: "10px 18px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
  error: {
    marginTop: 12,
    padding: 10,
    background: "#FFEBEE",
    color: "#C62828",
    borderRadius: 6,
    fontSize: 13,
  },
  resetBox: {
    marginTop: 8,
    padding: 12,
    background: "#FFF8E1",
    border: "1px solid #FFE082",
    borderRadius: 6,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  resetHint: { margin: "4px 0 0 0", color: "#777", fontSize: 12 },
  resetBtn: {
    padding: "8px 14px",
    background: "#FF9800",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  warningBanner: {
    padding: 12,
    background: "#FFF3E0",
    border: "1px solid #FFCC80",
    borderRadius: 6,
    color: "#E65100",
    fontSize: 13,
    fontWeight: 500,
  },
  passwordDisplay: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 14,
    background: "#F7F8FC",
    border: "2px dashed #4357AD",
    borderRadius: 8,
  },
  passwordText: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: 600,
    color: "#1E2A5E",
    letterSpacing: 1,
  },
  copyBtn: {
    padding: "8px 16px",
    background: "#4357AD",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },
};
