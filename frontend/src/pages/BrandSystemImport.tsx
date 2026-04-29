import { useState, useRef, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { importBrandFromFiles, createBrandSystem } from "../services/brandSystems";
import logoSvg from "../assets/logo.svg";
import { logout } from "../services/auth";

const NAV = [
  { path: "/",                   label: "Dashboard" },
  { path: "/analyze",            label: "Analyser" },
  { path: "/brand-system/new",   label: "Brand Systems" },
  { path: "/brand-system/import",label: "Importer un Brand" },
  { path: "/history",            label: "Historique" },
];

const FIELDS: { key: string; label: string; required?: boolean; rows?: number }[] = [
  { key: "brand_name",       label: "Nom du Brand",          required: true,  rows: 1 },
  { key: "brand_role",       label: "Brand Role",            required: true,  rows: 4 },
  { key: "master_statement", label: "Master Statement",      required: true,  rows: 2 },
  { key: "priorities",       label: "Priorités Stratégiques",required: true,  rows: 5 },
  { key: "territories",      label: "Territoires Narratifs", required: true,  rows: 5 },
  { key: "tone",             label: "Ton de la Marque",      required: true,  rows: 4 },
  { key: "red_lines",        label: "Lignes Rouges",         required: true,  rows: 4 },
  { key: "words_preferred",  label: "Mots Préférés",                          rows: 3 },
  { key: "words_avoid",      label: "Mots à Éviter",                          rows: 3 },
  { key: "audiences",        label: "Audiences Cibles",                       rows: 3 },
  { key: "sector",           label: "Secteur",                                rows: 1 },
];

type Step = "upload" | "review" | "saving" | "done";

export default function BrandSystemImport() {
  const nav = useNavigate();
  const [step, setStep]           = useState<Step>("upload");
  const [files, setFiles]         = useState<File[]>([]);
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sources, setSources]     = useState<string[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [warnings, setWarnings]   = useState<string[]>([]);
  const [form, setForm]           = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File helpers ── */
  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const accepted = Array.from(newFiles).filter(f =>
      /\.(pdf|docx|txt|md)$/i.test(f.name)
    );
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });
    setError("");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (name: string) =>
    setFiles(prev => prev.filter(f => f.name !== name));

  /* ── Extract ── */
  const handleExtract = async () => {
    if (!files.length) { setError("Ajoutez au moins un fichier."); return; }
    setLoading(true); setError("");
    try {
      const result = await importBrandFromFiles(files);
      setForm(result.data);
      setSources(result.sources);
      setCharCount(result.char_count);
      setWarnings(result.errors || []);
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Extraction échouée.");
    } finally { setLoading(false); }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.brand_name?.trim()) { setError("Le nom du brand est requis."); return; }
    setStep("saving");
    try {
      const res = await createBrandSystem(form);
      setStep("done");
      setTimeout(() => nav(`/brand-system/${res.id}/edit`), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sauvegarde échouée.");
      setStep("review");
    }
  };

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  /* ── Render ── */
  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
        </div>
        <nav className="sidebar-nav">
          <div style={{ marginBottom: 6, padding: "0 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.9px" }}>
            Navigation
          </div>
          {NAV.map(n => (
            <a key={n.path} href={n.path}
              className={`nav-item${n.path === "/brand-system/import" ? " active" : ""}`}
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Importer un Brand System</h1>
              <p className="page-sub">
                Uploadez vos documents de marque — l'IA extrait automatiquement tous les champs.
              </p>
            </div>
            <a href="/brand-system/new" className="btn-ghost"
              onClick={e => { e.preventDefault(); nav("/brand-system/new"); }}>
              Créer manuellement →
            </a>
          </div>

          {/* Step indicator */}
          <div className="step-indicator" style={{ marginBottom: 24 }}>
            {[
              { id: "upload", label: "1. Upload documents" },
              { id: "review", label: "2. Vérifier & éditer" },
              { id: "done",   label: "3. Enregistré" },
            ].map(s => (
              <div key={s.id} className={`step-dot ${step === s.id ? "active" : (step === "done" && s.id !== "done") || (step === "review" && s.id === "upload") ? "done" : ""}`}>
                <span className="step-num">{s.id === "upload" ? "1" : s.id === "review" ? "2" : "✓"}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <div>
              {/* Drop zone */}
              <div
                className={`import-dropzone${dragging ? " dragging" : ""}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <div className="dropzone-icon">📄</div>
                <p className="dropzone-title">
                  {dragging ? "Relâchez pour ajouter…" : "Glissez vos fichiers ici"}
                </p>
                <p className="dropzone-sub">ou cliquez pour sélectionner</p>
                <p className="dropzone-hint">PDF · DOCX · TXT · MD — plusieurs fichiers acceptés</p>
                <input ref={inputRef} type="file" multiple
                  accept=".pdf,.docx,.txt,.md"
                  style={{ display: "none" }}
                  onChange={e => addFiles(e.target.files)} />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="result-card" style={{ marginTop: 16 }}>
                  <p className="result-section-title">
                    {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
                  </p>
                  {files.map(f => (
                    <div key={f.name} className="import-file-row">
                      <span className="import-file-icon">
                        {f.name.endsWith(".pdf") ? "📕" : f.name.endsWith(".docx") ? "📘" : "📄"}
                      </span>
                      <span className="import-file-name">{f.name}</span>
                      <span className="import-file-size">{fmtSize(f.size)}</span>
                      <button className="import-file-rm" onClick={e => { e.stopPropagation(); removeFile(f.name); }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button className="btn-primary btn-analyze" onClick={handleExtract} disabled={loading || !files.length}>
                  {loading
                    ? <><span className="spinner spinner-sm" style={{ borderTopColor: "#fff" }} /> Extraction en cours…</>
                    : "🔍 Extraire les données du brand"}
                </button>
              </div>

              {loading && (
                <div className="import-progress-card">
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 3, borderTopColor: "var(--accent)" }} />
                  <div>
                    <p style={{ fontWeight: 500, color: "var(--text)", fontSize: 14 }}>Analyse IA en cours…</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Extraction du texte → Groq analyse les documents → Structuration des champs
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {(step === "review" || step === "saving") && (
            <div>
              {/* Extraction summary */}
              <div className="import-summary-card">
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)" }}>Sources</p>
                    <p style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{sources.join(", ")}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)" }}>Texte extrait</p>
                    <p style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{charCount.toLocaleString()} caractères</p>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <span style={{ background: "rgba(46,125,94,0.1)", color: "#2e7d5e", border: "1px solid rgba(46,125,94,0.25)", borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                      ✓ Extraction complète
                    </span>
                  </div>
                </div>
                {warnings.length > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(176,125,40,0.06)", border: "1px solid rgba(176,125,40,0.2)", borderRadius: "var(--radius-xs)" }}>
                    {warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: "var(--warn)" }}>⚠ {w}</p>)}
                  </div>
                )}
              </div>

              {/* Editable form */}
              <div className="result-card" style={{ marginTop: 16 }}>
                <p className="result-section-title">Données extraites — vérifiez et ajustez si nécessaire</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {FIELDS.map(f => (
                    <div key={f.key} className="form-field">
                      <label className="form-label">
                        {f.label}
                        {f.required && <span className="required-star">*</span>}
                      </label>
                      {f.rows === 1
                        ? <input className="form-input" type="text"
                            value={form[f.key] || ""}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                        : <textarea className="form-textarea form-input"
                            rows={f.rows}
                            style={{ minHeight: (f.rows || 3) * 24 + 18 }}
                            value={form[f.key] || ""}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "space-between" }}>
                <button className="btn-ghost" onClick={() => { setStep("upload"); setError(""); }}>
                  ← Recommencer
                </button>
                <button className="btn-primary btn-analyze"
                  onClick={handleSave}
                  disabled={step === "saving"}>
                  {step === "saving"
                    ? <><span className="spinner spinner-sm" style={{ borderTopColor: "#fff" }} /> Enregistrement…</>
                    : "💾 Enregistrer le Brand System"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === "done" && (
            <div className="empty-cta" style={{ marginTop: 16, background: "rgba(46,125,94,0.06)", border: "1.5px solid rgba(46,125,94,0.25)" }}>
              <div style={{ fontSize: "2.5rem" }}>✅</div>
              <p style={{ fontFamily: "'Lora',serif", fontSize: 18, color: "var(--text)", fontWeight: 500 }}>
                Brand System enregistré !
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Redirection vers la fiche pour révision finale…
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
