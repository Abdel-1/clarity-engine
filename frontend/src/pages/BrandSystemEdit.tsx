import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBrandSystem, updateBrandSystem } from "../services/brandSystems";

const FIELDS = [
  { key: "brand_name",       label: "Brand Name",            required: true,  rows: 1 },
  { key: "brand_role",       label: "Brand Role",            required: true,  rows: 3 },
  { key: "master_statement", label: "Master Statement",      required: true,  rows: 3 },
  { key: "priorities",       label: "Strategic Priorities",  required: true,  rows: 4 },
  { key: "territories",      label: "Narrative Territories", required: true,  rows: 4 },
  { key: "tone",             label: "Brand Tone",            required: true,  rows: 3 },
  { key: "red_lines",        label: "Red Lines",             required: true,  rows: 3 },
  { key: "words_preferred",  label: "Preferred Words",       required: false, rows: 2 },
  { key: "words_avoid",      label: "Words to Avoid",        required: false, rows: 2 },
  { key: "audiences",        label: "Target Audiences",      required: false, rows: 2 },
  { key: "sector",           label: "Sector",                required: false, rows: 1 },
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
    });
  }, [id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await updateBrandSystem(Number(id), form);
      nav("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page-loading"><span className="spinner" /> Loading…</div>;

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Brand System</h1>
          <p className="page-sub">Version {version} → {version + 1} on save</p>
        </div>
        <a href="/" className="back-link">← Back</a>
      </div>

      <form onSubmit={handleSubmit} className="bs-form">
        <div className="form-grid">
          {FIELDS.map(f => (
            <div key={f.key} className={`form-field${f.rows === 1 ? " field-inline" : " field-full"}`}>
              <label className="form-label">
                {f.label}{f.required && <span className="required-star">*</span>}
              </label>
              {f.rows === 1 ? (
                <input className="form-input" value={form[f.key] || ""}
                  onChange={e => set(f.key, e.target.value)} required={f.required} />
              ) : (
                <textarea className="form-textarea" rows={f.rows} value={form[f.key] || ""}
                  onChange={e => set(f.key, e.target.value)} required={f.required} />
              )}
            </div>
          ))}
        </div>
        {error && <p className="form-error">❌ {error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : `Save (v${version + 1})`}
          </button>
          <a href="/" className="btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
  );
}
