import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import logoSvg from "../assets/logo.svg";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";

interface ClientRow {
  id: number; company_name: string; sector: string | null;
  total_analyses: number; avg_score: number; last_score: number | null;
  user_count: number; created_at: string;
}
interface GlobalStats {
  total_clients: number; total_analyses: number; avg_score: number;
  last_score: number | null; best_improvement: number | null;
  avg_before_rewrite: number | null; avg_after_rewrite: number | null;
  top_scorers: { title: string; score: number; date: string }[];
}

const scoreColor = (s: number) => s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const NAV = [
  { path: "/admin", label: "Admin Panel" },
  { path: "/",      label: "Dashboard" },
];

export default function AdminDashboard() {
  const nav = useNavigate();
  const [stats, setStats]     = useState<GlobalStats | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ company_name: "", sector: "", admin_email: "", admin_password: "" });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/stats`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/admin/clients`, { headers: authHeaders() }).then(r => r.json()),
    ]).then(([s, c]) => { setStats(s); setClients(c); }).finally(() => setLoading(false));
  }, []);

  const handleCreateClient = async () => {
    setCreating(true); setCreateErr("");
    try {
      const r = await fetch(`${API}/admin/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(newForm),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail); }
      setShowNew(false);
      setNewForm({ company_name: "", sector: "", admin_email: "", admin_password: "" });
      // Refresh
      const c = await fetch(`${API}/admin/clients`, { headers: authHeaders() }).then(r => r.json());
      setClients(c);
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Error");
    } finally { setCreating(false); }
  };

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
          <span style={{ fontSize: 9, background: "var(--accent)", color: "#fff", padding: "2px 7px", borderRadius: 100, fontWeight: 700, marginTop: 4, display: "inline-block" }}>
            ADMIN
          </span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <a key={n.path} href={n.path} className={`nav-item${n.path === "/admin" ? " active" : ""}`}
              onClick={e => { e.preventDefault(); nav(n.path); }}>{n.label}</a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>Sign Out</button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 960 }}>
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Admin Panel</h1>
              <p className="dash-subtitle">Vue globale de tous les clients Clarity Engine</p>
            </div>
            <button className="btn-primary" onClick={() => setShowNew(v => !v)}>+ Nouveau Client</button>
          </header>

          {/* New client form */}
          {showNew && (
            <div className="result-card" style={{ marginBottom: 16, padding: "20px" }}>
              <p className="result-section-title" style={{ marginBottom: 12 }}>Créer un compte client</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { key: "company_name", label: "Nom de la société", type: "text" },
                  { key: "sector",       label: "Secteur",           type: "text" },
                  { key: "admin_email",  label: "Email du client",   type: "email" },
                  { key: "admin_password", label: "Mot de passe",    type: "password" },
                ].map(f => (
                  <div key={f.key} className="form-field">
                    <label className="form-label">{f.label}</label>
                    <input className="form-input" type={f.type}
                      value={newForm[f.key as keyof typeof newForm]}
                      onChange={e => setNewForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {createErr && <p className="form-error" style={{ marginTop: 8 }}>{createErr}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn-ghost" onClick={() => setShowNew(false)}>Annuler</button>
                <button className="btn-primary" onClick={handleCreateClient} disabled={creating}>
                  {creating ? "Création…" : "Créer le client"}
                </button>
              </div>
            </div>
          )}

          {/* Global KPIs */}
          {stats && (
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              {[
                { label: "Total Clients",       value: stats.total_clients,  color: "#2a5298" },
                { label: "Total Analyses",       value: stats.total_analyses, color: "#2a5298" },
                { label: "Score Moyen Global",   value: stats.avg_score ? `${stats.avg_score}/100` : "—", color: "#2e7d5e" },
                { label: "Meilleure Amélio.",    value: stats.best_improvement != null ? `+${stats.best_improvement} pts` : "—", color: "#b07d28" },
              ].map(k => (
                <div key={k.label} className="kpi-card" style={{ "--kpi-color": k.color } as React.CSSProperties}>
                  <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
                  <p className="kpi-value kpi-value-sm">{k.value}</p>
                  <div className="kpi-bar" />
                </div>
              ))}
            </div>
          )}

          {/* Avant / Après global */}
          {stats && (stats.avg_before_rewrite != null || stats.avg_after_rewrite != null) && (
            <div className="result-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
              <p className="result-section-title" style={{ marginBottom: 10 }}>Progression globale par réécriture IA</p>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>Score Départ (moy.)</p>
                  <p style={{ fontFamily: "'Lora',serif", fontSize: "1.8rem", fontWeight: 600, color: scoreColor(stats.avg_before_rewrite ?? 0) }}>{stats.avg_before_rewrite ?? "—"}</p>
                </div>
                <span style={{ fontSize: "1.5rem", color: "var(--text-dim)" }}>→</span>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>Score Arrivée (moy.)</p>
                  <p style={{ fontFamily: "'Lora',serif", fontSize: "1.8rem", fontWeight: 600, color: scoreColor(stats.avg_after_rewrite ?? 0) }}>{stats.avg_after_rewrite ?? "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Clients table */}
          <div className="result-card">
            <p className="result-section-title" style={{ marginBottom: 14 }}>Clients ({clients.length})</p>
            {loading ? (
              <div className="page-loading"><span className="spinner" /> Chargement…</div>
            ) : clients.length === 0 ? (
              <div className="empty-cta"><p>Aucun client pour l'instant.</p></div>
            ) : (
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Société</th><th>Secteur</th><th>Analyses</th>
                    <th>Score Moyen</th><th>Dernier Score</th><th>Utilisateurs</th><th>Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} className="table-row-clickable" onClick={() => nav(`/admin/clients/${c.id}`)}>
                      <td className="td-bold">{c.company_name}</td>
                      <td className="td-muted">{c.sector || "—"}</td>
                      <td><span style={{ fontWeight: 600, color: "var(--accent)" }}>{c.total_analyses}</span></td>
                      <td>
                        {c.avg_score > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 50, height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${c.avg_score}%`, background: scoreColor(c.avg_score) }} />
                            </div>
                            <span style={{ fontSize: 12, color: scoreColor(c.avg_score), fontWeight: 600 }}>{c.avg_score}</span>
                          </div>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td>
                        {c.last_score != null
                          ? <span className="score-pill" style={{ background: scoreColor(c.last_score) + "18", color: scoreColor(c.last_score), border: `1px solid ${scoreColor(c.last_score)}40` }}>{c.last_score}</span>
                          : <span className="td-muted">—</span>}
                      </td>
                      <td className="td-muted">{c.user_count}</td>
                      <td className="td-muted">{c.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Top scorers global */}
          {stats && stats.top_scorers?.length > 0 && (
            <div className="result-card" style={{ marginTop: 16, padding: "16px 20px" }}>
              <p className="result-section-title" style={{ marginBottom: 10 }}>Contenus 95%+ (global)</p>
              {stats.top_scorers.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: i < stats.top_scorers.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontFamily: "'Lora',serif", fontWeight: 600, color: "#2e7d5e", minWidth: 50 }}>{t.score}/100</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.date?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
