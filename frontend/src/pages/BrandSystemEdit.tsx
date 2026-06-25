import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBrandSystem, updateBrandSystem } from "../services/brandSystems";
import AppSidebar from "../components/AppSidebar";

const FIELDS = [
  { key: "brand_name",       label: "Nom de la marque",             required: true,  rows: 1 },
  { key: "brand_role",       label: "Rôle de la marque",             required: true,  rows: 3 },
  { key: "master_statement", label: "Déclaration maîtresse",         required: true,  rows: 3 },
  { key: "priorities",       label: "Priorités stratégiques",       required: true,  rows: 4 },
  { key: "territories",      label: "Territoires narratifs",        required: true,  rows: 4 },
  { key: "tone",             label: "Ton de la marque",             required: true,  rows: 3 },
  { key: "red_lines",        label: "Lignes rouges",                required: true,  rows: 3 },
  { key: "words_preferred",  label: "Mots préférés",                required: false, rows: 2 },
  { key: "words_avoid",      label: "Mots à éviter",                 required: false, rows: 2 },
  { key: "audiences",        label: "Audiences cibles",             required: false, rows: 2 },
  { key: "sector",           label: "Secteur",                      required: false, rows: 1 },
];

export default function BrandSystemEdit() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getBrandSystem(Number(id)).then(data => {
      const f: Record<string, string> = {};
      FIELDS.forEach(field => { f[field.key] = data[field.key] || ""; });
      setForm(f);
      setVersion(data.version || 1);
      setLoading(false);
    }).catch(() => {
      setError("Système de marque non trouvé");
      setLoading(false);
    });
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await updateBrandSystem(Number(id), form);
      nav("/admin/clients"); // Redirect back to clients list for admins
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page-loading"><span className="spinner spinner-lg" /> Chargement…</div>;

  return (
    <div className="dashboard-root">
      <AppSidebar role="admin" navItems={[
        { path: "/admin/clients",   label: "Clients",      icon: "◈" },
        { path: "/admin/analytics", label: "Analytiques",  icon: "✦" },
      ]} />
      <main className="dashboard-main">
        <div>
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Modifier le Système de Marque</h1>
              <p className="dash-subtitle">Version {version} → {version + 1} lors de l'enregistrement</p>
            </div>
            <button className="btn-ghost" onClick={() => nav(-1)}>← Retour</button>
          </header>

          {error && <div style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "var(--danger)", fontSize: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} className="result-card" style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
              {FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.rows === 1 ? "span 1" : "span 2" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    {f.label}{f.required && <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>}
                  </label>
                  {f.rows === 1 ? (
                    <input className="form-input" value={form[f.key] || ""}
                      onChange={e => set(f.key, e.target.value)} required={f.required}
                      style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", outline: "none" }} />
                  ) : (
                    <textarea className="form-textarea" rows={f.rows} value={form[f.key] || ""}
                      onChange={e => set(f.key, e.target.value)} required={f.required}
                      style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--text)", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32, display: "flex", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 160 }}>
                {saving ? "Enregistrement..." : `Enregistrer (v${version + 1})`}
              </button>
              <button type="button" className="btn-ghost" onClick={() => nav(-1)}>Annuler</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
