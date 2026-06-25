import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import logoSvg from "../assets/logo.svg";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";
function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

const BS_FIELDS = [
  { key: "brand_name",       label: "Brand Name",              required: true, rows: 1 },
  { key: "brand_role",       label: "Brand Role",              required: true, rows: 4 },
  { key: "master_statement", label: "Master Statement",        required: true, rows: 2 },
  { key: "priorities",       label: "Priorités Stratégiques",  required: true, rows: 4 },
  { key: "territories",      label: "Territoires Narratifs",   required: true, rows: 4 },
  { key: "tone",             label: "Ton de la Marque",        required: true, rows: 3 },
  { key: "red_lines",        label: "Lignes Rouges",           required: true, rows: 3 },
  { key: "words_preferred",  label: "Mots Préférés",                          rows: 2 },
  { key: "words_avoid",      label: "Mots à Éviter",                          rows: 2 },
  { key: "audiences",        label: "Audiences Cibles",                       rows: 2 },
  { key: "sector",           label: "Secteur",                                rows: 1 },
];

type Tab = "overview" | "brand" | "users";

interface ClientDetail {
  id: number; company_name: string; sector: string | null;
  created_at: string; total_analyses: number; avg_score: number;
  users: { id: number; email: string; full_name: string; created_at: string }[];
  brand_systems: BrandSystemRow[];
  recent_analyses: { id: number; message_title: string; clarity_score: number; analyzed_at: string }[];
}
interface BrandSystemRow {
  id: number; brand_name: string; sector: string | null; is_active: boolean;
  brand_role: string; master_statement: string; priorities: string;
  territories: string; tone: string; red_lines: string;
  words_preferred?: string; words_avoid?: string; audiences?: string;
  created_at: string; client_id: number;
}

const scoreColor = (s: number) => s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";

const NAV = [
  { path: "/admin", label: "Admin Panel" },
  { path: "/",      label: "Dashboard" },
];

export default function AdminClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const nav = useNavigate();
  const [data, setData]         = useState<ClientDetail | null>(null);
  const [tab, setTab]           = useState<Tab>("overview");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");

  // Client edit state
  const [editClient, setEditClient] = useState(false);
  const [clientForm, setClientForm] = useState({ company_name: "", sector: "" });

  // Brand system form state
  const [showBSForm, setShowBSForm] = useState(false);
  const [editingBS, setEditingBS]   = useState<BrandSystemRow | null>(null);
  const [bsForm, setBsForm]         = useState<Record<string, string>>({});

  // Password reset
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPass, setNewPass]         = useState("");

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/admin/clients/${clientId}`, { headers: authHeaders() });
    if (r.ok) {
      const d = await r.json();
      setData(d);
      setClientForm({ company_name: d.company_name, sector: d.sector || "" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // Save client info
  const saveClient = async () => {
    setSaving(true);
    const r = await fetch(`${API}/admin/clients/${clientId}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify(clientForm),
    });
    if (r.ok) { flash("Client mis a jour."); setEditClient(false); load(); }
    else flash("Erreur lors de la mise a jour.");
    setSaving(false);
  };

  // Save brand system (create or update)
  const saveBrandSystem = async () => {
    setSaving(true);
    let r;
    if (editingBS) {
      r = await fetch(`${API}/admin/brand-systems/${editingBS.id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(bsForm),
      });
    } else {
      r = await fetch(`${API}/admin/clients/${clientId}/brand-systems`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(bsForm),
      });
    }
    if (r.ok) { flash(editingBS ? "Brand System mis a jour." : "Brand System cree."); setShowBSForm(false); setEditingBS(null); setBsForm({}); load(); }
    else { const e = await r.json(); flash(e.detail || "Erreur."); }
    setSaving(false);
  };

  const deleteBrandSystem = async (bsId: number) => {
    if (!confirm("Desactiver ce Brand System ?")) return;
    await fetch(`${API}/admin/brand-systems/${bsId}`, { method: "DELETE", headers: authHeaders() });
    flash("Brand System desactive."); load();
  };

  // Reset password
  const resetPassword = async () => {
    if (!resetUserId || !newPass.trim()) return;
    setSaving(true);
    const r = await fetch(`${API}/admin/clients/${clientId}/users/${resetUserId}/reset-password`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ new_password: newPass }),
    });
    if (r.ok) { flash("Mot de passe mis a jour."); setResetUserId(null); setNewPass(""); }
    else flash("Erreur lors de la mise a jour du mot de passe.");
    setSaving(false);
  };

  const openEditBS = (bs: BrandSystemRow) => {
    setEditingBS(bs);
    const form: Record<string, string> = {};
    BS_FIELDS.forEach(f => { form[f.key] = (bs as unknown as Record<string, string>)[f.key] || ""; });
    setBsForm(form);
    setShowBSForm(true);
  };

  const openNewBS = () => {
    setEditingBS(null);
    setBsForm({});
    setShowBSForm(true);
  };

  if (loading) return <div className="page-loading"><span className="spinner spinner-lg" /> Chargement…</div>;
  if (!data) return <div className="page-loading">Client non trouvé.</div>;

  return (
    <div className="dashboard-root">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
          <span style={{ fontSize: 9, background: "var(--accent)", color: "#fff", padding: "2px 7px", borderRadius: 100, fontWeight: 700, marginTop: 4, display: "inline-block" }}>ADMIN</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <a key={n.path} href={n.path} className="nav-item"
              onClick={e => { e.preventDefault(); nav(n.path); }}>{n.label}</a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>Sign Out</button>
      </aside>

      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 960 }}>

          {/* Header */}
          <div className="page-header">
            <div>
              <button className="btn-ghost" style={{ marginBottom: 8, fontSize: 12 }}
                onClick={() => nav("/admin")}>← Admin Panel</button>
              <h1 className="page-title">{data.company_name}</h1>
              <p className="page-sub">{data.sector || "—"} · Créé le {data.created_at?.slice(0, 10)}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={() => setEditClient(v => !v)}>
                {editClient ? "Annuler" : "Modifier"}
              </button>
            </div>
          </div>

          {/* Flash message */}
          {msg && (
            <div style={{ background: "rgba(46,125,94,0.1)", border: "1px solid rgba(46,125,94,0.3)", borderRadius: "var(--radius-xs)", padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#2e7d5e" }}>
              {msg}
            </div>
          )}

          {/* Edit client form */}
          {editClient && (
            <div className="result-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
              <p className="result-section-title" style={{ marginBottom: 12 }}>Modifier le client</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-field">
                  <label className="form-label">Nom de la société</label>
                  <input className="form-input" value={clientForm.company_name}
                    onChange={e => setClientForm(p => ({ ...p, company_name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label className="form-label">Secteur</label>
                  <input className="form-input" value={clientForm.sector}
                    onChange={e => setClientForm(p => ({ ...p, sector: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn-primary" onClick={saveClient} disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {([
              { key: "overview", label: "Vue d'ensemble" },
              { key: "brand",    label: `Brand Systems (${data.brand_systems.length})` },
              { key: "users",    label: `Utilisateurs (${data.users.length})` },
            ] as { key: Tab; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
                  background: "none", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
                  color: tab === t.key ? "var(--text)" : "var(--text-dim)", marginBottom: -1,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Overview tab ── */}
          {tab === "overview" && (
            <div>
              <div className="kpi-grid" style={{ marginBottom: 16 }}>
                {[
                  { label: "Total Analyses", value: data.total_analyses, color: "#2a5298" },
                  { label: "Score Moyen", value: data.avg_score ? `${data.avg_score}/100` : "—", color: "#2e7d5e" },
                  { label: "Brand Systems", value: data.brand_systems.length, color: "#b07d28" },
                  { label: "Utilisateurs", value: data.users.length, color: "#2a5298" },
                ].map(k => (
                  <div key={k.label} className="kpi-card" style={{ "--kpi-color": k.color } as React.CSSProperties}>
                    <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
                    <p className="kpi-value kpi-value-sm">{k.value}</p>
                    <div className="kpi-bar" />
                  </div>
                ))}
              </div>

              {data.recent_analyses.length > 0 && (
                <div className="result-card">
                  <p className="result-section-title" style={{ marginBottom: 12 }}>Analyses récentes</p>
                  <table className="doc-table">
                    <thead><tr><th>Date</th><th>Titre</th><th>Score</th></tr></thead>
                    <tbody>
                      {data.recent_analyses.map(a => (
                        <tr key={a.id} className="table-row-clickable" onClick={() => nav(`/analysis/${a.id}`)}>
                          <td className="td-muted">{a.analyzed_at?.slice(0, 10)}</td>
                          <td className="td-bold">{a.message_title}</td>
                          <td>
                            <span className="score-pill" style={{ background: scoreColor(a.clarity_score) + "18", color: scoreColor(a.clarity_score), border: `1px solid ${scoreColor(a.clarity_score)}40` }}>
                              {a.clarity_score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Brand Systems tab ── */}
          {tab === "brand" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn-primary" onClick={openNewBS}>+ Nouveau Brand System</button>
              </div>

              {/* Brand system form */}
              {showBSForm && (
                <div className="result-card" style={{ marginBottom: 16, padding: "20px" }}>
                  <p className="result-section-title" style={{ marginBottom: 14 }}>
                    {editingBS ? `Modifier: ${editingBS.brand_name}` : "Nouveau Brand System"}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {BS_FIELDS.map(f => (
                      <div key={f.key} className="form-field">
                        <label className="form-label">
                          {f.label}{f.required && <span className="required-star">*</span>}
                        </label>
                        {f.rows === 1
                          ? <input className="form-input" value={bsForm[f.key] || ""}
                              onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                          : <textarea className="form-input form-textarea" rows={f.rows}
                              style={{ minHeight: (f.rows || 3) * 24 + 18 }}
                              value={bsForm[f.key] || ""}
                              onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        }
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button className="btn-ghost" onClick={() => { setShowBSForm(false); setEditingBS(null); setBsForm({}); }}>
                      Annuler
                    </button>
                    <button className="btn-primary" onClick={saveBrandSystem} disabled={saving || !bsForm.brand_name}>
                      {saving ? "Enregistrement…" : editingBS ? "Mettre à jour" : "Créer"}
                    </button>
                  </div>
                </div>
              )}

              {/* Brand systems list */}
              {data.brand_systems.length === 0 ? (
                <div className="empty-cta">
                  <p>Aucun Brand System pour ce client.</p>
                  <button className="btn-primary" onClick={openNewBS}>+ Créer le premier</button>
                </div>
              ) : (
                data.brand_systems.map(bs => (
                  <div key={bs.id} className="result-card" style={{ marginBottom: 12, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>{bs.brand_name}</p>
                        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
                          {bs.sector || "—"} · Créé le {bs.created_at?.slice(0, 10)}
                          {!bs.is_active && <span style={{ marginLeft: 8, color: "#c0392b", fontWeight: 600 }}>· INACTIF</span>}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, maxWidth: 540 }}>{bs.master_statement}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 12px" }}
                          onClick={() => openEditBS(bs)}>Modifier</button>
                        {bs.is_active && (
                          <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 12px", color: "#c0392b", borderColor: "rgba(192,57,43,0.3)" }}
                            onClick={() => deleteBrandSystem(bs.id)}>Désactiver</button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "Ton", val: bs.tone?.slice(0, 60) },
                        { label: "Lignes Rouges", val: bs.red_lines?.slice(0, 60) },
                      ].map(m => m.val && (
                        <div key={m.label} style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--bg3)", padding: "3px 10px", borderRadius: 100 }}>
                          <strong>{m.label}:</strong> {m.val}{m.val.length >= 60 ? "…" : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Users tab ── */}
          {tab === "users" && (
            <div className="result-card">
              <p className="result-section-title" style={{ marginBottom: 12 }}>Utilisateurs du compte</p>
              {data.users.length === 0 ? (
                <div className="empty-cta"><p>Aucun utilisateur.</p></div>
              ) : (
                <table className="doc-table">
                  <thead><tr><th>Email</th><th>Nom</th><th>Créé le</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data.users.map(u => (
                      <tr key={u.id}>
                        <td className="td-bold">{u.email}</td>
                        <td className="td-muted">{u.full_name || "—"}</td>
                        <td className="td-muted">{u.created_at?.slice(0, 10)}</td>
                        <td>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }}
                            onClick={() => { setResetUserId(u.id); setNewPass(""); }}>
                            Réinitialiser MDP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Password reset form */}
              {resetUserId && (
                <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)" }}>
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    Nouveau mot de passe pour {data.users.find(u => u.id === resetUserId)?.email}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="form-input" type="password" placeholder="Nouveau mot de passe"
                      value={newPass} onChange={e => setNewPass(e.target.value)}
                      style={{ flex: 1 }} />
                    <button className="btn-ghost" onClick={() => setResetUserId(null)}>Annuler</button>
                    <button className="btn-primary" onClick={resetPassword} disabled={saving || !newPass.trim()}>
                      {saving ? "…" : "Confirmer"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
