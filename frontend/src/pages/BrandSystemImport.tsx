import { useState, useRef } from "react";
import type { DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { extractBrandSystem, createBrandSystem, type ExtractionResult } from "../services/brandSystems";
import AppSidebar from "../components/AppSidebar";

const NAV = [
  { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
  { path: "/brand/users",     label: "Équipe",           icon: "◎" },
  { path: "/history",         label: "Historique",       icon: "◷" },
];

/* ── Field definitions (v1 schema → display) ─────────────────────── */
type FieldDef = {
  key:       string;   // key in ExtractionResult.data
  dbKey:     string;   // key for createBrandSystem payload
  label:     string;
  required?: boolean;
  isArray:   boolean;  // array field → joined for display, shown as textarea
  rows:      number;
};

const FIELDS: FieldDef[] = [
  { key: "nom_marque",              dbKey: "brand_name",      label: "Nom de la marque",         required: true,  isArray: false, rows: 1 },
  { key: "role_marque",             dbKey: "brand_role",      label: "Rôle de la marque",         required: true,  isArray: false, rows: 4 },
  { key: "master_statement",        dbKey: "master_statement",label: "Déclaration maîtresse",     required: true,  isArray: false, rows: 2 },
  { key: "priorites_strategiques",  dbKey: "priorities",      label: "Priorités stratégiques",   required: true,  isArray: true,  rows: 6 },
  { key: "territoires_narratifs",   dbKey: "territories",     label: "Territoires narratifs",    required: true,  isArray: true,  rows: 6 },
  { key: "ton_marque",              dbKey: "tone",            label: "Ton de la marque",         required: true,  isArray: false, rows: 4 },
  { key: "lignes_rouges",           dbKey: "red_lines",       label: "Lignes rouges",            required: true,  isArray: true,  rows: 5 },
  { key: "mots_a_privilegier",      dbKey: "words_preferred", label: "Mots à privilégier",                        isArray: true,  rows: 4 },
  { key: "mots_a_eviter",           dbKey: "words_avoid",     label: "Mots à éviter",                             isArray: true,  rows: 4 },
  { key: "audiences_cles",          dbKey: "audiences",       label: "Audiences clés",                            isArray: true,  rows: 4 },
  { key: "contexte_sectoriel",      dbKey: "sector",          label: "Contexte sectoriel",                        isArray: false, rows: 2 },
];

type Step = "upload" | "review" | "saving" | "done";

/* ── Helper: array field → display string ──────────────────────────── */
function arrayToText(arr: string[]): string {
  return arr.map(s => `- ${s}`).join("\n");
}

/* ── Extraction summary banner ─────────────────────────────────────── */
function ExtractionBanner({ result }: { result: ExtractionResult }) {
  const missing = result.data.champs_manquants ?? [];
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "16px 20px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: 0.5 }}>Sources</p>
          <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, fontWeight: 500 }}>{result.sources.join(", ")}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: 0.5 }}>Volume extrait</p>
          <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, fontWeight: 500 }}>{result.char_count.toLocaleString()} caractères</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: 0.5 }}>Prompt v{result.extraction_version}</p>
          <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4, fontWeight: 500 }}>DeepSeek v4-pro</p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{
            background: "rgba(46,125,94,0.1)", color: "var(--success)",
            borderRadius: 100, padding: "4px 14px", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.5px"
          }}>✓ Extraction réussie</span>
        </div>
      </div>

      {missing.length > 0 && (
        <div style={{
          marginTop: 14, padding: "12px 14px",
          background: "rgba(176,125,40,0.07)", borderRadius: 8,
          border: "1px solid rgba(176,125,40,0.18)",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)", marginBottom: 6 }}>
            {missing.length} champ{missing.length > 1 ? "s" : ""} absent{missing.length > 1 ? "s" : ""} du document — à compléter manuellement :
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {missing.map(m => (
              <span key={m} style={{
                background: "rgba(176,125,40,0.12)", color: "var(--warn)",
                borderRadius: 4, padding: "2px 10px", fontSize: 11, fontWeight: 600
              }}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {result.errors?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {result.errors.map((w, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--warn)" }}>{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function BrandSystemImport() {
  const nav = useNavigate();

  const [step, setStep]         = useState<Step>("upload");
  const [files, setFiles]       = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  // form values: key = FieldDef.key, value = text (arrays joined with \n)
  const [form, setForm]             = useState<Record<string, string>>({});
  // set of extraction keys that are in champs_manquants
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());

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
      const result = await extractBrandSystem(files);
      setExtraction(result);

      // Build form state — array fields joined as bullet lines
      const initial: Record<string, string> = {};
      for (const fd of FIELDS) {
        const raw = result.data[fd.key as keyof typeof result.data];
        initial[fd.key] = fd.isArray
          ? arrayToText(raw as string[])
          : (raw as string) ?? "";
      }
      setForm(initial);
      setMissingKeys(new Set(result.data.champs_manquants ?? []));
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Extraction échouée.");
    } finally { setLoading(false); }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!form["nom_marque"]?.trim()) {
      setError("Le nom de la marque est requis."); return;
    }
    setStep("saving");
    try {
      // Build DB payload: array fields → bullet-list strings
      const payload: Record<string, string> = {};
      for (const fd of FIELDS) {
        payload[fd.dbKey] = form[fd.key] ?? "";
      }
      if (extraction) {
        payload.source_file = extraction.sources.join(", ");
        payload.raw_extraction_json = JSON.stringify(extraction.data, null, 2);
      }
      await createBrandSystem(payload);
      setStep("done");
      setTimeout(() => nav("/admin/clients"), 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sauvegarde échouée.");
      setStep("review");
    }
  };

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  const isMissing = (key: string) => missingKeys.has(key);

  /* ── Render ── */
  return (
    <div className="dashboard-root">
      <AppSidebar role="brand_admin" navItems={NAV} />

      <main className="dashboard-main">
        <div className="page-content">

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 className="dash-title" style={{ marginBottom: 6 }}>Importer un Brand System</h1>
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Uploadez vos documents — DeepSeek extrait automatiquement tous les champs.
              </p>
            </div>
            <button className="btn-ghost" onClick={() => nav(-1)}>← Retour</button>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
            {[
              { id: "upload", label: "1. Documents" },
              { id: "review", label: "2. Vérifier & éditer" },
              { id: "done",   label: "3. Enregistré" },
            ].map((s, idx) => {
              const isActive = step === s.id || (step === "saving" && s.id === "review");
              const isDone   = (step === "review" || step === "saving" || step === "done") && s.id === "upload"
                            || step === "done" && s.id === "review";
              return (
                <div key={s.id} style={{
                  flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 10,
                  background: isActive ? "var(--gold-dim)" : "var(--bg2)",
                  border: isActive ? "1px solid var(--gold)" : "1px solid var(--border)",
                  color: isActive ? "var(--gold)" : isDone ? "var(--success)" : "var(--text-dim)",
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", fontSize: 11,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--gold)" : isDone ? "var(--success)" : "var(--bg3)",
                    color: isActive || isDone ? "var(--bg)" : "var(--text-dim)",
                  }}>
                    {isDone ? "✓" : idx + 1}
                  </span>
                  {s.label}
                </div>
              );
            })}
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
                <div className="dropzone-icon">▤</div>
                <p className="dropzone-title">
                  {dragging ? "Relâchez pour ajouter…" : "Glissez vos fichiers ici"}
                </p>
                <p className="dropzone-sub">ou cliquez pour sélectionner</p>
                <p className="dropzone-hint">PDF · DOCX · TXT · MD</p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  id="brand-file-input"
                  style={{ display: "none" }}
                  onChange={e => addFiles(e.target.files)}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="result-card" style={{ marginTop: 20, padding: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>
                    {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {files.map(f => (
                      <div key={f.name} className="import-file-row">
                        <span className="import-file-icon">
                          ▤
                        </span>
                        <span className="import-file-name">{f.name}</span>
                        <span className="import-file-size">{fmtSize(f.size)}</span>
                        <button
                          className="import-file-rm"
                          onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                          title="Retirer"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="form-error" style={{ marginTop: 14 }}>❌ {error}</div>
              )}

              <button
                id="extract-brand-btn"
                className="btn-primary"
                onClick={handleExtract}
                disabled={loading || !files.length}
                style={{ width: "100%", marginTop: 24, height: 50, fontSize: 15, justifyContent: "center" }}
              >
                {loading ? (
                  <><span className="spinner" style={{ borderTopColor: "#fff" }} /> Extraction en cours…</>
                ) : (
                  <>✦ Extraire les données du Brand System</>
                )}
              </button>

              {loading && (
                <div style={{
                  marginTop: 16, padding: "16px 20px",
                  background: "var(--bg2)", borderRadius: 10,
                  display: "flex", gap: 14, alignItems: "center",
                  border: "1px solid var(--border)"
                }}>
                  <div className="spinner spinner-lg" />
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>
                      DeepSeek analyse vos documents…
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                      Extraction des champs d'identité de marque en cours.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Review & edit ── */}
          {(step === "review" || step === "saving") && extraction && (
            <div>
              <ExtractionBanner result={extraction} />

              {/* Extraction assistant notice */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: "rgba(201,164,73,0.06)", border: "1px solid var(--gold-border)",
                borderRadius: 10, padding: "14px 18px", marginBottom: 24,
              }}>
                <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>▤</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                    Extraction assistée — vérification humaine requise
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    Relisez et corrigez chaque champ avant d'enregistrer.
                    Les champs surlignés en orange sont absents du document : complétez-les manuellement.
                    L'enregistrement ne crée pas de nouveau Brand System si un système actif existe déjà pour ce client.
                  </p>
                </div>
              </div>

              {/* Editable form */}
              <div className="result-card" style={{ padding: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 24 }}>
                  Révision des données extraites
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  {FIELDS.map(fd => {
                    const missing = isMissing(fd.key);
                    return (
                      <div key={fd.key}>
                        <label
                          htmlFor={`field-${fd.key}`}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            fontSize: 12, fontWeight: 700,
                            color: missing ? "var(--warn)" : "var(--text-muted)",
                            marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4,
                          }}
                        >
                          {fd.label}
                          {fd.required && <span style={{ color: "var(--danger)" }}>*</span>}
                          {missing && (
                            <span style={{
                              fontSize: 10, background: "rgba(176,125,40,0.12)",
                              color: "var(--warn)", borderRadius: 4,
                              padding: "1px 8px", fontWeight: 700, textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}>
                              À compléter
                            </span>
                          )}
                          {fd.isArray && !missing && (
                            <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 400, textTransform: "none" }}>
                              une entrée par ligne, préfixe « - »
                            </span>
                          )}
                        </label>
                        {fd.rows === 1 ? (
                          <input
                            id={`field-${fd.key}`}
                            type="text"
                            value={form[fd.key] ?? ""}
                            onChange={e => setForm(p => ({ ...p, [fd.key]: e.target.value }))}
                            style={{
                              width: "100%", boxSizing: "border-box",
                              background: missing ? "rgba(176,125,40,0.06)" : "var(--bg3)",
                              border: `1px solid ${missing ? "rgba(176,125,40,0.4)" : "var(--border)"}`,
                              borderRadius: 8, padding: "10px 14px",
                              color: "var(--text)", outline: "none",
                            }}
                          />
                        ) : (
                          <textarea
                            id={`field-${fd.key}`}
                            rows={fd.rows}
                            value={form[fd.key] ?? ""}
                            onChange={e => setForm(p => ({ ...p, [fd.key]: e.target.value }))}
                            style={{
                              width: "100%", boxSizing: "border-box",
                              background: missing ? "rgba(176,125,40,0.06)" : "var(--bg3)",
                              border: `1px solid ${missing ? "rgba(176,125,40,0.4)" : "var(--border)"}`,
                              borderRadius: 8, padding: "12px 14px",
                              color: "var(--text)", outline: "none",
                              resize: "vertical", fontFamily: "inherit",
                              lineHeight: 1.6, minHeight: fd.rows * 22,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && <div className="form-error" style={{ marginTop: 14 }}>❌ {error}</div>}

              <div style={{ display: "flex", gap: 12, marginTop: 28, justifyContent: "space-between" }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setStep("upload"); setError(""); setExtraction(null); }}
                >
                  ← Recommencer
                </button>
                <button
                  id="save-brand-btn"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={step === "saving"}
                  style={{ minWidth: 220, justifyContent: "center" }}
                >
                  {step === "saving"
                    ? <><span className="spinner" style={{ borderTopColor: "#fff" }} /> Enregistrement…</>
                    : "Valider et enregistrer"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === "done" && (
            <div className="empty-cta" style={{ marginTop: 40, padding: 60 }}>
              <div style={{ fontSize: "4rem", marginBottom: 24 }}>✅</div>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 24, color: "var(--text)", marginBottom: 12 }}>
                Brand System enregistré !
              </h2>
              <p style={{ color: "var(--text-dim)", fontSize: 15, maxWidth: 400, margin: "0 auto" }}>
                Votre identité de marque a été créée avec succès.<br />
                Redirection vers la liste des clients…
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
