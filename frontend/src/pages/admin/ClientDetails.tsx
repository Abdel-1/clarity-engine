import { useState, useEffect, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import logoSvg from "../../assets/logo.svg";

const API = "http://127.0.0.1:8000";

const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",   icon: "◈" },
  { path: "/admin/analytics", label: "Analytics", icon: "✦" },
];

const BS_FIELDS: { key: string; label: string; rows: number }[] = [
  { key: "brand_name",       label: "Brand Name",              rows: 1 },
  { key: "brand_role",       label: "Brand Role",              rows: 3 },
  { key: "master_statement", label: "Master Statement",        rows: 2 },
  { key: "priorities",       label: "Strategic Priorities",    rows: 4 },
  { key: "territories",      label: "Narrative Territories",   rows: 4 },
  { key: "tone",             label: "Tone of Voice",           rows: 3 },
  { key: "red_lines",        label: "Red Lines",               rows: 3 },
  { key: "words_preferred",  label: "Preferred Words",         rows: 2 },
  { key: "words_avoid",      label: "Words to Avoid",          rows: 2 },
  { key: "audiences",        label: "Target Audiences",        rows: 2 },
  { key: "sector",           label: "Sector",                  rows: 1 },
];

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [client,    setClient]    = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [editMode,  setEditMode]  = useState(false);
  const [editBS,    setEditBS]    = useState<number | null>(null);

  // Client info edit state
  const [companyName, setCompanyName] = useState("");
  const [sector,      setSector]      = useState("");

  // Brand system edit state
  const [bsForm, setBsForm] = useState<Record<string, string>>({});

  // Brand admin form state
  const [showBrandAdminForm, setShowBrandAdminForm] = useState(false);
  const [baEmail,    setBaEmail]    = useState("");
  const [baPassword, setBaPassword] = useState("");
  const [baFullName, setBaFullName] = useState("");
  const [baSaving,   setBaSaving]   = useState(false);
  const [baError,    setBaError]    = useState("");
  const [baSuccess,  setBaSuccess]  = useState("");

  useEffect(() => { loadClient(); }, [id]);

  async function loadClient() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (r.status === 401) { logout(); window.location.href = "/login"; return; }
      if (!r.ok) throw new Error("Failed to load client details");
      const data = await r.json();
      setClient(data);
      setCompanyName(data.company_name);
      setSector(data.sector || "");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleUpdateClient(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ company_name: companyName, sector }),
      });
      if (!r.ok) throw new Error("Update failed");
      setEditMode(false);
      loadClient();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDeleteClient() {
    if (!window.confirm("Are you sure? This will delete all users and brand systems for this client.")) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error("Delete failed");
      nav("/admin/clients");
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  async function handleUpdateBS(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}/brand-systems/${editBS}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(bsForm),
      });
      if (!r.ok) throw new Error("Update failed");
      setEditBS(null);
      loadClient();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDeleteBS(bsId: number) {
    if (!window.confirm("Delete this brand system?")) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}/brand-systems/${bsId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) throw new Error("Delete failed");
      loadClient();
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  async function handleCreateBrandAdmin(e: FormEvent) {
    e.preventDefault();
    setBaSaving(true); setBaError(""); setBaSuccess("");
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}/brand-admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email: baEmail, password: baPassword, full_name: baFullName }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create brand admin");
      }
      setBaSuccess(`Brand admin ${baEmail} created!`);
      setBaEmail(""); setBaPassword(""); setBaFullName("");
      loadClient();
    } catch (err: any) { setBaError(err.message); }
    finally { setBaSaving(false); }
  }

  const startEditBS = (bs: any) => {
    const f: any = {};
    BS_FIELDS.forEach(field => { f[field.key] = bs[field.key] || ""; });
    setBsForm(f);
    setEditBS(bs.id);
  };

  if (loading && !client) return <div className="page-loading"><span className="spinner" /> Loading client…</div>;

  return (
    <div className="dashboard-root">
      <aside className="sidebar" style={{ background: "linear-gradient(180deg, #0f1923 0%, #131f2e 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="sidebar-brand" style={{ background: "rgba(42,82,152,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 16px" }}>
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%", filter: "brightness(1.8)" }} />
          <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "rgba(253,211,53,0.8)", textTransform: "uppercase", letterSpacing: "1.2px" }}>Admin Panel</div>
        </div>
        <nav className="sidebar-nav" style={{ padding: "16px 10px" }}>
          {NAV_ADMIN.map(n => (
            <a key={n.path} href={n.path} className="nav-item" style={{ color: n.path === "/admin/clients" ? "#fdd335" : "rgba(255,255,255,0.55)" }} onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span style={{ marginRight: 10 }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>Sign Out</button>
      </aside>

      <main className="dashboard-main" style={{ background: "#0d1520" }}>
        <div style={{ maxWidth: 900 }}>
          <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <h1 style={{ color: "#fff", fontSize: 24, marginBottom: 4 }}>{client?.company_name}</h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Client Details & Brand Governance</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-ghost" onClick={() => nav("/admin/clients")}>← Back to List</button>
              <button className="btn-primary" style={{ background: "#c0392b", borderColor: "#c0392b" }} onClick={handleDeleteClient}>Delete Client</button>
            </div>
          </header>

          {error && <div className="form-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* Client Info Card */}
          <div className="result-card" style={{ marginBottom: 32, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontSize: 18 }}>Organisation Info</h2>
              <button className="btn-ghost" onClick={() => setEditMode(!editMode)}>{editMode ? "Cancel" : "Edit Info"}</button>
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateClient} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Company Name</label>
                  <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Sector</label>
                  <input className="form-input" value={sector} onChange={e => setSector(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" style={{ alignSelf: "flex-start" }}>Save Changes</button>
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Sector</p>
                  <p style={{ color: "#fff", fontSize: 16 }}>{client?.sector || "—"}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Created At</p>
                  <p style={{ color: "#fff", fontSize: 16 }}>{client?.created_at?.slice(0, 10)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Users List */}
          <div className="result-card" style={{ marginBottom: 32, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#fff", fontSize: 18 }}>User Accounts</h2>
              <button
                id="btn-add-brand-admin"
                style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(46,200,140,0.1)", border: "1px solid rgba(46,200,140,0.3)", color: "#2ec88c", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                onClick={() => setShowBrandAdminForm(v => !v)}>
                {showBrandAdminForm ? "✕ Cancel" : "+ Brand Admin"}
              </button>
            </div>

            {showBrandAdminForm && (
              <form onSubmit={handleCreateBrandAdmin} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20, padding: 16, background: "rgba(46,200,140,0.04)", border: "1px solid rgba(46,200,140,0.15)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "rgba(46,200,140,0.7)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>New Brand Admin</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={baFullName} onChange={e => setBaFullName(e.target.value)} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={baEmail} onChange={e => setBaEmail(e.target.value)} placeholder="jane@brand.com" required />
                  </div>
                  <div>
                    <label className="form-label">Password *</label>
                    <input className="form-input" type="password" value={baPassword} onChange={e => setBaPassword(e.target.value)} placeholder="Min 6 chars" required minLength={6} />
                  </div>
                </div>
                {baError   && <p style={{ color: "#c0392b", fontSize: 12, margin: 0 }}>{baError}</p>}
                {baSuccess && <p style={{ color: "#2ec88c", fontSize: 12, margin: 0 }}>{baSuccess}</p>}
                <button type="submit" disabled={baSaving} style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0d1520", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: baSaving ? "not-allowed" : "pointer", opacity: baSaving ? 0.6 : 1 }}>
                  {baSaving ? "Creating…" : "Create Brand Admin"}
                </button>
              </form>
            )}

            <table className="doc-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th></tr>
              </thead>
              <tbody>
                {client?.users.map((u: any) => (
                  <tr key={u.id}>
                    <td style={{ color: "#fff" }}>{u.full_name || "—"}</td>
                    <td style={{ color: "rgba(255,255,255,0.6)" }}>{u.email}</td>
                    <td>
                      <span className="risk-badge" style={{
                        background: u.role === "brand_admin"
                          ? "rgba(46,200,140,0.15)"
                          : "rgba(255,255,255,0.1)",
                        color: u.role === "brand_admin" ? "#2ec88c" : "#fff",
                      }}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* Brand Systems List */}
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 16 }}>Brand Systems</h2>
          {client?.brand_systems.map((bs: any) => (
            <div key={bs.id} className="result-card" style={{ marginBottom: 20, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ color: "#fdd335", fontSize: 18, marginBottom: 4 }}>{bs.brand_name} <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>v{bs.version}</span></h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Last updated: {bs.updated_at?.slice(0, 10)}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn-ghost" onClick={() => startEditBS(bs)}>Edit System</button>
                  <button className="btn-ghost" style={{ color: "#c0392b" }} onClick={() => handleDeleteBS(bs.id)}>Delete</button>
                </div>
              </div>

              {editBS === bs.id ? (
                <form onSubmit={handleUpdateBS} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {BS_FIELDS.map(f => (
                    <div key={f.key}>
                      <label className="form-label">{f.label}</label>
                      {f.rows === 1
                        ? <input className="form-input" value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        : <textarea className="form-textarea form-input" rows={f.rows} value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 12 }}>
                    <button type="submit" className="btn-primary">Save System</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditBS(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                   {/* Summary of main fields */}
                   <div><p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Brand Role</p><p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{bs.brand_role}</p></div>
                   <div><p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Tone</p><p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{bs.tone}</p></div>
                </div>
              )}
            </div>
          ))}

          {client?.brand_systems.length === 0 && (
             <div style={{ padding: 40, textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.1)" }}>
                <p style={{ color: "rgba(255,255,255,0.4)" }}>No brand system provisioned for this client yet.</p>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => nav("/admin/clients/new")}>Onboard Client</button>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
