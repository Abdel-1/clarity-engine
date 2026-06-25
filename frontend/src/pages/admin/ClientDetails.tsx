import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import { setBrandSystemAccess, setMemberAccess } from "../../services/brandSystems";
import AppSidebar from "../../components/AppSidebar";
import Select from "../../components/Select";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000");

const NAV = [
  { path: "/admin/clients",   label: "Clients",     icon: "◈" },
  { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
  { path: "/history",         label: "Historique",  icon: "◷" },
];

type BSField = { key: string; label: string; rows: number; hint: string; half?: boolean; tone?: "good" | "bad" };
const BS_GROUPS: { title: string; icon: string; fields: BSField[] }[] = [
  {
    title: "Identité",
    icon: "◆",
    fields: [
      { key: "brand_name",       label: "Nom de marque",       rows: 1, half: true, hint: "Le nom officiel de la marque." },
      { key: "sector",           label: "Secteur",             rows: 1, half: true, hint: "Industrie ou domaine d'activité." },
      { key: "brand_role",       label: "Rôle de la marque",   rows: 3, hint: "Ce que la marque accomplit fondamentalement pour ses audiences." },
      { key: "master_statement", label: "Promesse principale", rows: 2, hint: "La phrase signature qui résume la marque." },
    ],
  },
  {
    title: "Stratégie & récit",
    icon: "✦",
    fields: [
      { key: "priorities",  label: "Priorités stratégiques", rows: 4, hint: "Les axes que chaque message devrait faire avancer." },
      { key: "territories", label: "Territoires narratifs",  rows: 4, hint: "Les thèmes que la marque s'approprie dans son discours." },
      { key: "audiences",   label: "Audiences cibles",       rows: 2, hint: "Les publics prioritaires que la marque adresse." },
    ],
  },
  {
    title: "Voix & garde-fous",
    icon: "⬡",
    fields: [
      { key: "tone",            label: "Ton de voix",        rows: 3, hint: "Le registre et la personnalité de l'expression." },
      { key: "words_preferred", label: "Mots à privilégier", rows: 2, half: true, tone: "good", hint: "Vocabulaire valorisé, à favoriser dans les messages." },
      { key: "words_avoid",     label: "Mots à éviter",      rows: 2, half: true, tone: "bad",  hint: "Termes bannis — un seul plafonne le score d'alignement." },
      { key: "red_lines",       label: "Lignes rouges",      rows: 3, tone: "bad", hint: "Interdits absolus : les franchir effondre l'alignement." },
    ],
  },
];
// Flat list kept for populating / iterating the form by key.
const BS_FIELDS: BSField[] = BS_GROUPS.flatMap(g => g.fields);

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  analysis_enabled?: boolean;
}

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

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser,  setEditingUser]  = useState<User | null>(null);
  const [uEmail,       setUEmail]       = useState("");
  const [uPassword,    setUPassword]    = useState("");
  const [uFullName,    setUFullName]    = useState("");
  const [uRole,        setURole]        = useState("membre");
  const [uSaving,      setUSaving]      = useState(false);
  const [uError,       setUError]       = useState("");
  const [uSuccess,     setUSuccess]     = useState("");

  const authHeader = { Authorization: `Bearer ${getToken()}` };

  useEffect(() => { loadClient(); }, [id]);

  async function loadClient() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}`, {
        headers: authHeader as HeadersInit,
      });
      if (r.status === 401) { logout(); window.location.href = "/login"; return; }
      if (!r.ok) throw new Error("Impossible de charger ce client");
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
        headers: { "Content-Type": "application/json", ...authHeader } as HeadersInit,
        body: JSON.stringify({ company_name: companyName, sector }),
      });
      if (!r.ok) throw new Error("Mise à jour échouée");
      setEditMode(false);
      loadClient();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDeleteClient() {
    if (!window.confirm("Confirmer ? Cette action supprimera tous les utilisateurs et brand systems de ce client.")) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}`, {
        method: "DELETE",
        headers: authHeader as HeadersInit,
      });
      if (!r.ok) throw new Error("Suppression échouée");
      nav("/admin/clients");
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  async function handleUpdateBS(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}/brand-systems/${editBS}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader } as HeadersInit,
        body: JSON.stringify(bsForm),
      });
      if (!r.ok) throw new Error("Mise à jour échouée");
      setEditBS(null);
      loadClient();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleDeleteBS(bsId: number) {
    if (!window.confirm(
      "Supprimer définitivement ce Brand System ?\n\n" +
      "Toutes ses analyses seront supprimées. S'il s'agit du dernier Brand System de ce client, " +
      "tous les utilisateurs du client et le client lui-même seront également supprimés.\n\n" +
      "Cette action est irréversible."
    )) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${id}/brand-systems/${bsId}`, {
        method: "DELETE",
        headers: authHeader as HeadersInit,
      });
      if (!r.ok) throw new Error("Delete failed");
      const data = await r.json().catch(() => ({}));
      if (data.client_deleted) {
        nav("/admin/clients");        // whole client was purged → leave the page
      } else {
        loadClient();
      }
    } catch (err: any) { setError(err.message); setLoading(false); }
  }

  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault();
    setUSaving(true); setUError(""); setUSuccess("");
    try {
      const url = editingUser 
        ? `${API}/api/admin/users/${editingUser.id}` 
        : `${API}/api/admin/clients/${id}/${uRole === 'brand_admin' ? 'brand-admins' : 'users'}`;
      
      const method = editingUser ? "PUT" : "POST";
      const body: any = { email: uEmail, full_name: uFullName };
      if (!editingUser) body.password = uPassword;
      if (editingUser) body.role = uRole;

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader } as HeadersInit,
        body: JSON.stringify(body),
      });
      
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Impossible de ${editingUser ? 'modifier' : 'créer'} l'utilisateur`);
      }
      
      setUSuccess(`Utilisateur ${uEmail} ${editingUser ? 'mis à jour' : 'créé'} avec succès !`);
      resetUserForm();
      loadClient();
    } catch (err: any) { setUError(err.message); }
    finally { setUSaving(false); }
  }

  async function handleDeleteUser(userId: number, email: string) {
    if (!window.confirm(`Supprimer l'utilisateur ${email} ?`)) return;
    try {
      const r = await fetch(`${API}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: authHeader as HeadersInit,
      });
      if (!r.ok) throw new Error("Suppression échouée");
      loadClient();
    } catch (err: any) { setError(err.message); }
  }

  // Suspend / resume the analysis engine for a brand system or a member.
  async function toggleBSAccess(bsId: number, enabled: boolean) {
    try { await setBrandSystemAccess(bsId, enabled); loadClient(); }
    catch (err: any) { setError(err.message); }
  }
  async function toggleUserAccess(userId: number, enabled: boolean) {
    try { await setMemberAccess(userId, enabled); loadClient(); }
    catch (err: any) { setError(err.message); }
  }

  const resetUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);
    setUEmail("");
    setUPassword("");
    setUFullName("");
    setURole("membre");
    setUError("");
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setUEmail(user.email);
    setUFullName(user.full_name || "");
    setURole(user.role);
    setShowUserForm(true);
    setUError("");
    setUSuccess("");
  };

  const startNewUser = () => {
    setEditingUser(null);
    setUEmail("");
    setUPassword("");
    setUFullName(client?.company_name || "");
    setURole("membre");
    setShowUserForm(true);
    setUError("");
    setUSuccess("");
  };

  if (loading && !client) return <div className="page-loading"><span className="spinner" /> Chargement du client…</div>;

  return (
    <div className="dashboard-root">
      <AppSidebar role="admin" navItems={NAV} />

      <main className="dashboard-main">
        <div>
          <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <h1 style={{ color: "var(--text)", fontSize: 24, marginBottom: 4 }}>{client?.company_name}</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Client Details & Brand Governance</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn-ghost" onClick={() => nav("/admin/clients")}>← Back to List</button>
              <button className="btn-primary" style={{ background: "#c0392b", borderColor: "#c0392b" }} onClick={handleDeleteClient}>Delete Client</button>
            </div>
          </header>

          {error && <div className="form-error" style={{ marginBottom: 20 }}>{error}</div>}

          {/* Client Info Card */}
          <div className="result-card" style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ color: "var(--text)", fontSize: 18 }}>Informations de l'organisation</h2>
              <button className="btn-ghost" onClick={() => setEditMode(!editMode)}>{editMode ? "Annuler" : "Modifier"}</button>
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateClient} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Nom de l'entreprise</label>
                  <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Secteur</label>
                  <input className="form-input" value={sector} onChange={e => setSector(e.target.value)} />
                </div>
                <button type="submit" className="btn-primary" style={{ alignSelf: "flex-start" }}>Enregistrer</button>
              </form>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase" }}>Secteur</p>
                  <p style={{ color: "var(--text)", fontSize: 16 }}>{client?.sector || "—"}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase" }}>Créé le</p>
                  <p style={{ color: "var(--text)", fontSize: 16 }}>{client?.created_at?.slice(0, 10)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Users List */}
          <div className="result-card" style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "var(--text)", fontSize: 18 }}>Comptes utilisateurs</h2>
              <button
                style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(46,200,140,0.1)", border: "1px solid rgba(46,200,140,0.3)", color: "#2ec88c", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
                onClick={() => { if (showUserForm) resetUserForm(); else startNewUser(); }}>
                {showUserForm ? "✕ Annuler" : "+ Nouvel Utilisateur"}
              </button>
            </div>

            {showUserForm && (
              <form onSubmit={handleUserSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20, padding: 16, background: "rgba(46,200,140,0.04)", border: "1px solid rgba(46,200,140,0.15)", borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: "rgba(46,200,140,0.7)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {editingUser ? "Modifier l'utilisateur" : "Nouvel Utilisateur"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">Nom complet</label>
                    <input className="form-input" value={uFullName} onChange={e => setUFullName(e.target.value)} placeholder="Marie Dupont" />
                  </div>
                  <div>
                    <label className="form-label">Email <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input className="form-input" type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="marie@marque.com" required />
                  </div>
                  {!editingUser ? (
                    <div>
                      <label className="form-label">Mot de passe <span style={{ color: "var(--danger)" }}>*</span></label>
                      <input className="form-input" type="password" value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="Min 6 caractères" required minLength={6} />
                    </div>
                  ) : (
                    <div>
                      <label className="form-label">Rôle</label>
                      <Select
                        value={uRole}
                        onChange={setURole}
                        ariaLabel="Rôle"
                        size="md"
                        fullWidth
                        options={[
                          { value: "membre", label: "Membre" },
                          { value: "brand_admin", label: "Brand Admin" },
                          { value: "admin", label: "Super Admin" },
                        ]}
                      />
                    </div>
                  )}
                </div>
                {!editingUser && (
                   <div>
                    <label className="form-label">Rôle initial</label>
                    <div style={{ display: "flex", gap: 16 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}>
                        <input type="radio" name="role" value="membre" checked={uRole === 'membre'} onChange={() => setURole('membre')} /> Membre
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)" }}>
                        <input type="radio" name="role" value="brand_admin" checked={uRole === 'brand_admin'} onChange={() => setURole('brand_admin')} /> Brand Admin
                      </label>
                    </div>
                  </div>
                )}
                {uError   && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{uError}</p>}
                {uSuccess && <p style={{ color: "var(--success)", fontSize: 12, margin: 0 }}>{uSuccess}</p>}
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="submit" disabled={uSaving} style={{ padding: "8px 20px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0b1622", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: uSaving ? "not-allowed" : "pointer", opacity: uSaving ? 0.6 : 1 }}>
                    {uSaving ? "Chargement..." : editingUser ? "Enregistrer" : "Créer"}
                  </button>
                  <button type="button" onClick={resetUserForm} className="btn-ghost" style={{ fontSize: 13 }}>Annuler</button>
                </div>
              </form>
            )}

            <table className="doc-table">
              <thead>
                <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Analyse</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {client?.users.map((u: User) => (
                  <tr key={u.id} id={`user-row-${u.id}`}>
                    <td style={{ color: "var(--text)" }}>{u.full_name || "—"}</td>
                    <td style={{ color: "var(--text-muted)" }}>{u.email}</td>
                    <td>
                      <span className="risk-badge" style={{
                        background: u.role === "brand_admin"
                          ? "rgba(46, 200, 140, 0.15)"
                          : u.role === "admin" ? "var(--gold-dim)" : "rgba(148, 163, 184, 0.15)",
                        color: u.role === "brand_admin" ? "#2ec88c" : u.role === "admin" ? "var(--gold)" : "var(--text-muted)",
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.role === "admin" ? (
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Exempt</span>
                      ) : (() => {
                        const on = u.analysis_enabled ?? true;
                        return (
                          <button
                            onClick={() => toggleUserAccess(u.id, !on)}
                            title={on ? "Suspendre l'accès à l'analyse" : "Réactiver l'accès à l'analyse"}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                              background: on ? "rgba(46,200,140,0.12)" : "rgba(248,113,113,0.12)",
                              border: `1px solid ${on ? "rgba(46,200,140,0.4)" : "rgba(248,113,113,0.4)"}`,
                              color: on ? "#2ec88c" : "#f87171",
                              borderRadius: 100, padding: "4px 11px", fontSize: 11, fontWeight: 700,
                            }}
                          >
                            {on ? "● Active" : "○ Suspendu"}
                          </button>
                        );
                      })()}
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEditUser(u)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)", fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
                        Modifier
                      </button>
                      <button onClick={() => handleDeleteUser(u.id, u.email)} style={{ background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", opacity: 0.8 }}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          {/* Brand Systems List */}
          <h2 style={{ color: "var(--text)", fontSize: 20, marginBottom: 16 }}>Brand Systems</h2>
          {client?.brand_systems.map((bs: any) => (
            <div key={bs.id} className="result-card" style={{ marginBottom: 20, background: "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h3 style={{ color: "var(--accent)", fontSize: 18, marginBottom: 4 }}>{bs.brand_name} <span style={{ fontSize: 12, color: "var(--text-dim)" }}>v{bs.version}</span></h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Mis à jour le {bs.updated_at?.slice(0, 10)}</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {(() => {
                    const on = bs.analysis_enabled ?? true;
                    return (
                      <button
                        onClick={() => toggleBSAccess(bs.id, !on)}
                        title={on ? "Suspendre l'analyse pour ce Brand System" : "Réactiver l'analyse"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                          background: on ? "rgba(46,200,140,0.10)" : "rgba(248,113,113,0.12)",
                          border: `1px solid ${on ? "rgba(46,200,140,0.35)" : "rgba(248,113,113,0.45)"}`,
                          color: on ? "#2ec88c" : "#f87171",
                          borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                        }}
                      >
                        {on ? "● Analyse active" : "○ Analyse suspendue"}
                      </button>
                    );
                  })()}
                  <button className="btn-ghost" onClick={() => {
                    const f: any = {};
                    BS_FIELDS.forEach(field => { f[field.key] = bs[field.key] || ""; });
                    setBsForm(f);
                    setEditBS(bs.id);
                  }}>Modifier</button>
                  <button className="btn-ghost" style={{ color: "var(--danger)" }} onClick={() => handleDeleteBS(bs.id)}>Supprimer</button>
                </div>
              </div>

              {/* Decision KPIs for this brand system — informs the suspend/resume call above */}
              {bs.analyses_count != null && (
                <div style={{ display: "flex", gap: 24, marginBottom: 20, padding: "12px 16px", background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Score moyen ({bs.analyses_count} analyse{bs.analyses_count !== 1 ? "s" : ""})</p>
                    <p style={{ fontFamily: "'Lora',serif", fontSize: "1.3rem", fontWeight: 600, color: bs.avg_score >= 75 ? "#2e7d5e" : bs.avg_score >= 50 ? "#b07d28" : "#c0392b" }}>
                      {bs.avg_score}/100
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>% Risque élevé</p>
                    <p style={{ fontFamily: "'Lora',serif", fontSize: "1.3rem", fontWeight: 600, color: bs.pct_high_risk > 20 ? "#c0392b" : bs.pct_high_risk > 0 ? "#b07d28" : "#2e7d5e" }}>
                      {bs.pct_high_risk}%
                    </p>
                  </div>
                </div>
              )}

              {editBS === bs.id ? (
                <form onSubmit={handleUpdateBS} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  {BS_GROUPS.map(group => (
                    <div key={group.title}>
                      {/* Section header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, paddingBottom: 9, borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--accent)", fontSize: 13 }}>{group.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.09em" }}>{group.title}</span>
                      </div>
                      {/* Fields grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                        {group.fields.map(f => {
                          const accent = f.tone === "good" ? "#2ec88c" : f.tone === "bad" ? "#e05252" : null;
                          return (
                            <div key={f.key} style={{
                              gridColumn: f.half ? "span 1" : "1 / -1",
                              ...(accent ? { borderLeft: `2px solid ${accent}55`, paddingLeft: 13 } : {}),
                            }}>
                              <label className="form-label" style={accent ? { color: accent } : undefined}>{f.label}</label>
                              <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "4px 0 8px", lineHeight: 1.45, textTransform: "none", letterSpacing: 0 }}>{f.hint}</p>
                              {f.rows === 1
                                ? <input className="form-input" value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                                : <textarea className="form-textarea form-input" rows={f.rows} value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))} />
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <button type="submit" className="btn-primary">Enregistrer les modifications</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditBS(null)}>Annuler</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                   {/* Summary of main fields */}
                   <div><p style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>Rôle de marque</p><p style={{ fontSize: 13, color: "var(--text-muted)" }}>{bs.brand_role}</p></div>
                   <div><p style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>Ton</p><p style={{ fontSize: 13, color: "var(--text-muted)" }}>{bs.tone}</p></div>
                </div>
              )}
            </div>
          ))}

          {client?.brand_systems.length === 0 && (
             <div style={{ padding: 40, textAlign: "center", background: "var(--bg2)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                <p style={{ color: "var(--text-dim)" }}>Aucun Brand System configuré pour ce client.</p>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => nav("/admin/clients/new")}>Créer un client</button>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
