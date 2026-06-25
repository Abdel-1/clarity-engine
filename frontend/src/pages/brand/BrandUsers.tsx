import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { getToken } from "../../services/auth";
import AppSidebar from "../../components/AppSidebar";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000");

const NAV = [
  { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
  { path: "/brand/users",     label: "Équipe",           icon: "◎" },
  { path: "/history",         label: "Historique",       icon: "◷" },
];

interface BrandUser { id: number; email: string; full_name: string | null; role: string; }

export default function BrandUsers() {
  const [users,    setUsers]    = useState<BrandUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<BrandUser | null>(null);
  
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
      .then((r) => { if (!r.ok) throw new Error("Impossible de charger l'équipe"); return r.json(); })
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setEditingUser(null);
    setShowForm(false);
    setFormErr("");
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormErr(""); setSuccess("");
    try {
      const url = editingUser 
        ? `${API}/api/brand/users/${editingUser.id}` 
        : `${API}/api/brand/users`;
      
      const method = editingUser ? "PUT" : "POST";
      
      const body: any = { email, full_name: fullName };
      if (!editingUser) body.password = password;

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Impossible de ${editingUser ? 'modifier' : 'créer'} l'utilisateur`);
      }
      
      setSuccess(`Utilisateur ${email} ${editingUser ? 'mis à jour' : 'créé'} avec succès !`);
      resetForm();
      loadUsers();
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: BrandUser) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${user.email} ?`)) return;
    
    try {
      const r = await fetch(`${API}/api/brand/users/${user.id}`, {
        method: "DELETE",
        headers: authHeader,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || "Impossible de supprimer l'utilisateur");
      }
      setSuccess("Utilisateur supprimé");
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const startEdit = (user: BrandUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setFullName(user.full_name || "");
    setShowForm(true);
    setFormErr("");
    setSuccess("");
  };

  return (
    <div className="dashboard-root">
      <AppSidebar role="brand_admin" navItems={NAV} />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", padding: 28 }}>
        <div>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4, fontFamily: "'Lora', serif" }}>
                Membres de l'équipe
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {users.length} membre{users.length !== 1 ? "s" : ""} dans votre organisation
              </p>
            </div>
            <button id="btn-add-user"
              style={{ padding: "9px 20px", borderRadius: 10, background: "#2ec88c", border: "none", color: "#0b1622", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              onClick={() => { if (showForm) resetForm(); else setShowForm(true); setSuccess(""); }}>
              {showForm ? "✕ Annuler" : "+ Ajouter un membre"}
            </button>
          </header>

          {/* Success banner */}
          {success && (
            <div style={{ background: "rgba(46,200,140,0.10)", border: "1px solid rgba(46,200,140,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#2ec88c", fontSize: 13 }}>
              {success}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="result-card" style={{ marginBottom: 24, border: "1px solid rgba(46,200,140,0.15)" }}>
              <h2 style={{ color: "#2ec88c", fontSize: 16, marginBottom: 20 }}>
                {editingUser ? "Modifier le membre" : "Nouveau membre"}
              </h2>
              <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="form-label">Nom complet</label>
                  <input id="new-user-name" className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Marie Dupont" />
                </div>
                <div>
                  <label className="form-label">Email <span className="required-star">*</span></label>
                  <input id="new-user-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marie@entreprise.com" required />
                </div>
                {!editingUser && (
                  <div>
                    <label className="form-label">Mot de passe <span className="required-star">*</span></label>
                    <input id="new-user-password" className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 caractères" required minLength={6} />
                  </div>
                )}
                {formErr && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{formErr}</p>}
                <div style={{ display: "flex", gap: 12 }}>
                  <button id="btn-save-user" type="submit" disabled={saving}
                    style={{ padding: "9px 24px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0b1622", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Chargement..." : editingUser ? "Enregistrer les modifications" : "Créer le membre"}
                  </button>
                  <button type="button" onClick={resetForm} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users list */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", padding: "40px 0" }}>
              <div className="spinner" style={{ borderTopColor: "#2ec88c" }} /> Chargement de l'équipe…
            </div>
          ) : error ? (
            <p style={{ color: "var(--danger)" }}>{error}</p>
          ) : users.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", background: "var(--bg2)", border: "1.5px dashed var(--border)", borderRadius: 16 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>◎</div>
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Aucun membre pour le moment.</p>
              <button style={{ marginTop: 16, padding: "9px 20px", borderRadius: 8, background: "#2ec88c", border: "none", color: "#0b1622", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                onClick={() => setShowForm(true)}>
                Ajouter votre premier membre →
              </button>
            </div>
          ) : (
            <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="doc-table">
                <thead>
                  <tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} id={`user-row-${u.id}`}>
                      <td className="td-bold">{u.full_name || "—"}</td>
                      <td className="td-muted">{u.email}</td>
                      <td>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 100, background: "rgba(46,200,140,0.10)", color: "#2ec88c", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {u.role === "membre" ? "Membre" : u.role}
                        </span>
                      </td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEdit(u)} style={{ background: "transparent", border: "1px solid var(--border)", color: "#2ec88c", fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}>
                          Modifier
                        </button>
                        <button onClick={() => handleDeleteUser(u)} style={{ background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: 11, padding: "4px 8px", borderRadius: 4, cursor: "pointer", opacity: 0.8 }}>
                          Supprimer
                        </button>
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
