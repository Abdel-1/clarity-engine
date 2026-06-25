import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createBrandSystem } from "../services/brandSystems";

const FIELDS = [
  { key: "brand_name",       label: "Brand Name",             required: true,  rows: 1 },
  { key: "brand_role",       label: "Brand Role",             required: true,  rows: 3 },
  { key: "master_statement", label: "Master Statement",       required: true,  rows: 3 },
  { key: "priorities",       label: "Strategic Priorities",   required: true,  rows: 4 },
  { key: "territories",      label: "Narrative Territories",  required: true,  rows: 4 },
  { key: "tone",             label: "Brand Tone",             required: true,  rows: 3 },
  { key: "red_lines",        label: "Red Lines",              required: true,  rows: 3 },
  { key: "words_preferred",  label: "Preferred Words",        required: false, rows: 2 },
  { key: "words_avoid",      label: "Words to Avoid",         required: false, rows: 2 },
  { key: "audiences",        label: "Target Audiences",       required: false, rows: 2 },
  { key: "sector",           label: "Sector",                 required: false, rows: 1 },
];

export default function BrandSystemNew() {
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createBrandSystem(form);
      nav("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Brand System</h1>
          <p className="page-sub">Define your brand governance reference</p>
        </div>
        <a href="/" className="back-link">← Back to Dashboard</a>
      </div>

      <form onSubmit={handleSubmit} className="bs-form">
        <div className="form-grid">
          {FIELDS.map(f => (
            <div key={f.key} className={`form-field${f.rows === 1 ? " field-inline" : " field-full"}`}>
              <label className="form-label">
                {f.label}
                {f.required && <span className="required-star">*</span>}
              </label>
              {f.rows === 1 ? (
                <input
                  className="form-input"
                  value={form[f.key] || ""}
                  onChange={e => set(f.key, e.target.value)}
                  required={f.required}
                  placeholder={f.label}
                />
              ) : (
                <textarea
                  className="form-textarea"
                  rows={f.rows}
                  value={form[f.key] || ""}
                  onChange={e => set(f.key, e.target.value)}
                  required={f.required}
                  placeholder={f.label}
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="form-error">❌ {error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : "Save Brand System"}
          </button>
          <a href="/" className="btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
  );
}
