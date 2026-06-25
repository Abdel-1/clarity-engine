import { useState, useEffect } from "react";
import { getToken, getRole } from "../services/auth";
import AppSidebar from "../components/AppSidebar";
import type { PanelRole } from "../components/AppSidebar";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000");

interface MeData {
  full_name: string;
  email: string;
  role: PanelRole;
  created_at: string | null;
  analysis_enabled: boolean;
}

const ROLE_META: Record<PanelRole, { label: string; icon: string }> = {
  admin:       { label: "Administrateur",          icon: "◈" },
  brand_admin: { label: "Administrateur de marque", icon: "⬡" },
  membre:      { label: "Membre",                   icon: "◎" },
};

// Initials from a display name ("Jean Dupont" → "JD"), falling back to the email.
function initials(name: string, email: string): string {
  const src = (name || email.split("@")[0] || "").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (src.slice(0, 2) || "?").toUpperCase();
}

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function Profile() {
  const [profile, setProfile] = useState({ full_name: "", email: "" });
  const [me, setMe] = useState<MeData | null>(null);
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const authHeader = { Authorization: `Bearer ${getToken()}` };
  const role = getRole() as PanelRole;

  // Determine nav items based on role
  const getNavItems = () => {
    if (role === "admin") {
      return [
        { path: "/admin/clients",   label: "Clients",     icon: "◈" },
        { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
        { path: "/history",         label: "Historique",  icon: "◷" },
      ];
    } else if (role === "brand_admin") {
      return [
        { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
        { path: "/brand/users",     label: "Équipe",           icon: "◎" },
        { path: "/history",         label: "Historique",       icon: "◷" },
      ];
    } else {
      return [
        { path: "/",      label: "Tableau de bord", icon: "⬡" },
        { path: "/analyze", label: "Nouvelle analyse", icon: "✦" },
        { path: "/history", label: "Historique",       icon: "◷" },
      ];
    }
  };

  useEffect(() => {
    fetch(`${API}/api/me`, { headers: authHeader as HeadersInit })
      .then(r => r.json())
      .then(d => {
        const defaultName = d.full_name || d.email.split('@')[0];
        setProfile({ full_name: defaultName, email: d.email });
        setMe({
          full_name: defaultName,
          email: d.email,
          role: (d.role as PanelRole) || role,
          created_at: d.created_at ?? null,
          analysis_enabled: d.analysis_enabled !== false,
        });
        setLoading(false);
      })
      .catch(() => { setError("Impossible de charger le profil"); setLoading(false); });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true); setError(""); setSuccess("");
    try {
      const r = await fetch(`${API}/api/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader } as HeadersInit,
        body: JSON.stringify(profile),
      });
      if (!r.ok) throw new Error((await r.json()).detail || "Erreur lors de la mise à jour");
      setSuccess("Profil mis à jour avec succès");
      // Keep the hero card in sync with what was just saved.
      setMe(prev => prev ? { ...prev, full_name: profile.full_name, email: profile.email } : prev);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) {
      setError("Les nouveaux mots de passe ne correspondent pas");
      return;
    }
    setSavingPass(true); setError(""); setSuccess("");
    try {
      const r = await fetch(`${API}/api/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader } as HeadersInit,
        body: JSON.stringify({
          current_password: passForm.current,
          new_password: passForm.new
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Erreur lors de la mise à jour du mot de passe");
      // The server rotates the token on password change (other sessions are revoked);
      // store the fresh one so THIS session stays logged in.
      if (data.access_token) localStorage.setItem("token", data.access_token);
      setSuccess("Mot de passe mis à jour avec succès");
      setPassForm({ current: "", new: "", confirm: "" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPass(false);
    }
  };

  const roleMeta = ROLE_META[(me?.role ?? role)] ?? ROLE_META.membre;
  // Live password strength hint (length-only, matches the backend min policy of 6).
  const newPw = passForm.new;
  const pwStrength = !newPw ? 0 : newPw.length < 6 ? 1 : newPw.length < 10 ? 2 : 3;
  const pwMeta = [
    { label: "", color: "transparent" },
    { label: "Trop court", color: "#e05252" },
    { label: "Correct", color: "#f0a832" },
    { label: "Robuste", color: "#2ec88c" },
  ][pwStrength];

  return (
    <div className="dashboard-root">
      <AppSidebar role={role} navItems={getNavItems()} />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", padding: 28 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <header style={{ marginBottom: 22 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4, fontFamily: "'Lora', serif" }}>
              Mon Profil
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Gérez vos informations personnelles et votre sécurité</p>
          </header>

          {loading ? (
            <div className="spinner" />
          ) : (
            <>
              {/* ── Hero identity banner ─────────────────────────────── */}
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 18,
                  border: "1px solid var(--bg-border)",
                  background:
                    "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)",
                  boxShadow: "inset 0 3px 0 0 var(--gold)",
                  padding: "26px 28px",
                  marginBottom: 22,
                }}
              >
                {/* Decorative gold halo */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute", top: -90, right: -70, width: 240, height: 240,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(201,164,73,0.18) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", position: "relative" }}>
                  {/* Avatar */}
                  <div
                    style={{
                      width: 78, height: 78, flexShrink: 0,
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Lora', serif", fontSize: 30, fontWeight: 600,
                      color: "#1a1207",
                      background: "linear-gradient(135deg, var(--gold-bright), var(--gold-deep))",
                      boxShadow: "0 6px 20px rgba(201,164,73,0.35)",
                      border: "2px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {initials(me?.full_name ?? "", me?.email ?? "")}
                  </div>

                  {/* Identity */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{
                      fontFamily: "'Lora', serif", fontSize: 24, fontWeight: 600,
                      color: "var(--text)", lineHeight: 1.2, marginBottom: 4,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {me?.full_name || "—"}
                    </h2>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {me?.email}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        color: "var(--gold)", background: "var(--gold-dim)",
                        border: "1px solid var(--gold-border)",
                      }}>
                        <span>{roleMeta.icon}</span>{roleMeta.label}
                      </span>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                        color: me?.analysis_enabled ? "#2ec88c" : "#e05252",
                        background: me?.analysis_enabled ? "rgba(46,200,140,0.1)" : "rgba(224,82,82,0.1)",
                        border: `1px solid ${me?.analysis_enabled ? "rgba(46,200,140,0.25)" : "rgba(224,82,82,0.25)"}`,
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: me?.analysis_enabled ? "#2ec88c" : "#e05252",
                        }} />
                        {me?.analysis_enabled ? "Compte actif" : "Analyse suspendue"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.2)", color: "#e05252", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ background: "rgba(46,200,140,0.1)", border: "1px solid rgba(46,200,140,0.2)", color: "#2ec88c", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
                  {success}
                </div>
              )}

              {/* ── Two-column body: forms + account overview ────────── */}
              <div className="profile-grid">
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div className="result-card" style={{ marginBottom: 0 }}>
                    <h2 style={{ fontSize: 16, color: "var(--text)", marginBottom: 4 }}>Informations personnelles</h2>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
                      Votre nom apparaît dans l'historique et les analyses partagées.
                    </p>
                    <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <label className="form-label">Nom complet</label>
                        <input className="form-input" value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} placeholder="Votre nom" />
                      </div>
                      <div>
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} placeholder="votre@email.com" required />
                      </div>
                      <button type="submit" disabled={savingProfile} style={{ alignSelf: "flex-start", padding: "9px 24px", borderRadius: 8, background: "var(--accent)", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: savingProfile ? 0.6 : 1 }}>
                        {savingProfile ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </form>
                  </div>

                  <div className="result-card" style={{ marginBottom: 0 }}>
                    <h2 style={{ fontSize: 16, color: "var(--text)", marginBottom: 4 }}>Changer le mot de passe</h2>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 20 }}>
                      Par sécurité, vos autres sessions seront déconnectées.
                    </p>
                    <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <label className="form-label">Mot de passe actuel</label>
                        <input className="form-input" type="password" value={passForm.current} onChange={e => setPassForm({...passForm, current: e.target.value})} required />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label className="form-label">Nouveau mot de passe</label>
                          <input className="form-input" type="password" value={passForm.new} onChange={e => setPassForm({...passForm, new: e.target.value})} required minLength={6} />
                        </div>
                        <div>
                          <label className="form-label">Confirmer le nouveau mot de passe</label>
                          <input className="form-input" type="password" value={passForm.confirm} onChange={e => setPassForm({...passForm, confirm: e.target.value})} required minLength={6} />
                        </div>
                      </div>
                      {newPw && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 999, background: "var(--bg-input)", overflow: "hidden" }}>
                            <div style={{ width: `${(pwStrength / 3) * 100}%`, height: "100%", background: pwMeta.color, transition: "width 0.25s ease, background 0.25s ease" }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: pwMeta.color, minWidth: 62, textAlign: "right" }}>{pwMeta.label}</span>
                        </div>
                      )}
                      <button type="submit" disabled={savingPass} style={{ alignSelf: "flex-start", padding: "9px 24px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text)", fontWeight: 600, cursor: "pointer", opacity: savingPass ? 0.6 : 1 }}>
                        {savingPass ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Account overview side panel */}
                <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div className="result-card" style={{ marginBottom: 0 }}>
                    <div className="result-section-title">Aperçu du compte</div>
                    <InfoRow icon={roleMeta.icon} label="Rôle" value={roleMeta.label} />
                    <InfoRow icon="◷" label="Membre depuis" value={formatJoined(me?.created_at ?? null)} />
                    <InfoRow
                      icon="✦"
                      label="Moteur d'analyse"
                      value={me?.analysis_enabled ? "Activé" : "Suspendu"}
                      valueColor={me?.analysis_enabled ? "#2ec88c" : "#e05252"}
                      last
                    />
                  </div>

                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid var(--gold-border)",
                      background: "var(--gold-dim)",
                      padding: "16px 18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ color: "var(--gold)", fontSize: 15 }}>⛨</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Conseil de sécurité</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Choisissez un mot de passe unique d'au moins 10 caractères. Évitez de le réutiliser sur d'autres services.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── Key/value row for the account overview panel ─────────────────── */
function InfoRow({ icon, label, value, valueColor, last }: {
  icon: string; label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0",
      borderBottom: last ? "none" : "1px solid var(--bg-border)",
    }}>
      <span style={{
        width: 30, height: 30, flexShrink: 0, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--gold-dim)", border: "1px solid var(--gold-border)",
        color: "var(--gold)", fontSize: 14,
      }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-dim)" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: valueColor || "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
    </div>
  );
}
