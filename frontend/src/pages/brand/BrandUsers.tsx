import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";

const API = "http://127.0.0.1:8000";

interface BrandUser {
  id:        number;
  email:     string;
  full_name: string | null;
  role:      string;
}

export default function BrandUsers() {
  const nav = useNavigate();
  const [users,    setUsers]    = useState<BrandUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [showForm, setShowForm] = useState(false);

  // Add user form state
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");
  const [success,  setSuccess]  = useState("");

  const authHeader = { Authorization: `Bearer ${getToken()}` };

  const loadUsers = () => {
    setLoading(true); setError("");
    fetch(`${API}/api/brand/users`, { headers: authHeader })
      .then(r => { if (!r.ok) throw new Error("Failed to load team"); return r.json(); })
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormErr(""); setSuccess("");
    try {
      const r = await fetch(`${API}/api/brand/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create user");
      }
      setSuccess(`User ${email} created successfully!`);
      setEmail(""); setPassword(""); setFullName(""); setShowForm(false);
      loadUsers();
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const path = window.location.pathname;
  const NAV = [
    { path: "/brand/dashboard", label: "Dashboard", icon: "◈" },
    { path: "/brand/users",     label: "Team",      icon: "◎" },
  ];

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar" style={{ background: "linear-gradient(180deg, #0f1923 0%, #131f2e 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="sidebar-brand" style={{ background: "rgba(46,125,94,0.12)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 16px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Brand Admin</div>
          <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "rgba(46,200,140,0.7)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
            Team Management
          </div>
        </div>

        <nav className="sidebar-nav" style={{ padding: "16px 10px" }}>
          {NAV.map(n => (
            <a key={n.path} href={n.path}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                textDecoration: "none", fontSize: 13, fontWeight: 500,
                color: path === n.path ? "#2ec88c" : "rgba(255,255,255,0.55)",
                background: path === n.path ? "rgba(46,200,140,0.08)" : "transparent",
                border: path === n.path ? "1px solid rgba(46,200,140,0.2)" : "1px solid transparent",
                transition: "all 0.15s",
              }}
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>

        <button
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          onClick={() => { logout(); window.location.href = "/login"; }}>
          ⎋ Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main" style={{ background: "#0d1520" }}>
        <div style={{ maxWidth: 800 }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Team Members</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {users.length} user{users.length !== 1 ? "s" : ""} in your organisation
              </p>
            </div>
            <button
              id="btn-add-user"
              style={{
                padding: "9px 20px", borderRadius: 10, background: "#2ec88c", border: "none",
                color: "#0d1520", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              onClick={() => { setShowForm(v => !v); setFormErr(""); setSuccess(""); }}>
              {showForm ? "✕ Cancel" : "+ Add User"}
            </button>
          </header>

          {/* Success banner */}
          {success && (
            <div style={{ background: "rgba(46,200,140,0.12)", border: "1px solid rgba(46,200,140,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#2ec88c", fontSize: 13 }}>
              {success}
            </div>
          )}

          {/* Add user form */}
          {showForm && (
            <div className="result-card" style={{ marginBottom: 24, background: "rgba(46,200,140,0.04)", border: "1px solid rgba(46,200,140,0.15)" }}>
              <h2 style={{ color: "#2ec88c", fontSize: 16, marginBottom: 20 }}>Add New User</h2>
              <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Full Name</label>
                  <input id="new-user-name" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input id="new-user-email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" required />
                </div>
                <div>
                  <label className="form-label">Password *</label>
                  <input id="new-user-password" className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required minLength={6} />
                </div>
                {formErr && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{formErr}</p>}
                <div style={{ display: "flex", gap: 12 }}>
                  <button id="btn-save-user" type="submit" disabled={saving}
                    style={{ padding: "9px 24px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0d1520", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Creating…" : "Create User"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>
                  New users will have the <strong style={{ color: "rgba(255,255,255,0.5)" }}>client</strong> role — they can only use the analysis engine.
                </p>
              </form>
            </div>
          )}

          {/* Users table */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>
              <div className="spinner" style={{ borderTopColor: "#2ec88c", width: 22, height: 22, borderWidth: 2 }} />
              Loading team…
            </div>
          ) : error ? (
            <p style={{ color: "#c0392b" }}>{error}</p>
          ) : users.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.08)", borderRadius: 16 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>◎</div>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No team members yet.</p>
              <button
                style={{ marginTop: 16, padding: "9px 20px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0d1520", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                onClick={() => setShowForm(true)}>
                Add your first user →
              </button>
            </div>
          ) : (
            <div className="result-card" style={{ background: "rgba(255,255,255,0.03)" }}>
              <table className="doc-table">
                <thead>
                  <tr><th>#</th><th>Name</th><th>Email</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} id={`user-row-${u.id}`}>
                      <td className="td-muted" style={{ width: 40 }}>{i + 1}</td>
                      <td className="td-bold">{u.full_name || "—"}</td>
                      <td className="td-muted">{u.email}</td>
                      <td>
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: 100,
                          background: "rgba(46,200,140,0.12)", color: "#2ec88c",
                          fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
                        }}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
