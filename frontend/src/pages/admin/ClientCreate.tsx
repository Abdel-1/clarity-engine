import { useState, useRef, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import logoSvg from "../../assets/logo.svg";

const API = "http://127.0.0.1:8000";

const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",   icon: "◈" },
  { path: "/admin/analytics", label: "Analytics", icon: "✦" },
];

const STEP_LABELS = ["Organisation", "Brand System", "Credentials"];

const BS_FIELDS: { key: string; label: string; required?: boolean; rows: number; ph: string }[] = [
  { key: "brand_name",       label: "Brand Name",              required: true,  rows: 1, ph: "e.g. TechnoPark" },
  { key: "brand_role",       label: "Brand Role",              required: true,  rows: 3, ph: "What the brand stands for" },
  { key: "master_statement", label: "Master Statement",        required: true,  rows: 2, ph: "Core brand promise" },
  { key: "priorities",       label: "Strategic Priorities",    required: true,  rows: 4, ph: "Key focus areas" },
  { key: "territories",      label: "Narrative Territories",   required: true,  rows: 4, ph: "Brand narrative territories" },
  { key: "tone",             label: "Tone of Voice",           required: true,  rows: 3, ph: "e.g. Expert, Inspiring, Clear" },
  { key: "red_lines",        label: "Red Lines",               required: true,  rows: 3, ph: "What the brand must never do" },
  { key: "words_preferred",  label: "Preferred Words",         required: false, rows: 2, ph: "Comma-separated preferred vocabulary" },
  { key: "words_avoid",      label: "Words to Avoid",          required: false, rows: 2, ph: "Comma-separated words to avoid" },
  { key: "audiences",        label: "Target Audiences",        required: false, rows: 2, ph: "e.g. Startups, SMEs, Investors" },
  { key: "sector",           label: "Sector",                  required: false, rows: 1, ph: "e.g. Technology, Finance" },
];

type BsMode = "manual" | "import";
type ImportStep = "upload" | "review" | "saving" | "done";

export default function ClientCreate() {
  const nav = useNavigate();

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [sector,      setSector]      = useState("");

  // Step 2 – mode
  const [bsMode, setBsMode] = useState<BsMode>("manual");

  // Step 2 – manual form
  const [bsForm, setBsForm] = useState<Record<string, string>>({});

  // Step 2 – import flow
  const [files,        setFiles]        = useState<File[]>([]);
  const [dragging,     setDragging]     = useState(false);
  const [importStep,   setImportStep]   = useState<ImportStep>("upload");
  const [extracting,   setExtracting]   = useState(false);
  const [sources,      setSources]      = useState<string[]>([]);
  const [charCount,    setCharCount]    = useState(0);
  const [warnings,     setWarnings]     = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [step,    setStep]    = useState<1 | 2 | 3>(1);
  const [clientId, setClientId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const tok = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

  // ── Step 1 → create org ──────────────────────────────────────────────
  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients`, {
        method: "POST", headers: tok(),
        body: JSON.stringify({ company_name: companyName, sector: sector || null }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Failed to create client");
      const data = await r.json();
      setClientId(data.id);
      setStep(2);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ── Step 2 → PDF extraction via existing /api/brand-systems/import ──
  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const accepted = Array.from(fl).filter(f => /\.(pdf|docx|txt|md)$/i.test(f.name));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...accepted.filter(f => !names.has(f.name))];
    });
    setError("");
  };

  async function handleExtract() {
    if (!files.length) { setError("Add at least one file."); return; }
    setExtracting(true); setError("");
    try {
      const form = new FormData();
      files.forEach(f => form.append("files", f));
      const r = await fetch(`${API}/api/brand-systems/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Extraction failed");
      const result = await r.json();
      setBsForm(result.data || {});
      setSources(result.sources || []);
      setCharCount(result.char_count || 0);
      setWarnings(result.errors || []);
      setImportStep("review");
    } catch (err: any) { setError(err.message); }
    finally { setExtracting(false); }
  }

  // ── Step 2 → save brand system (manual OR after extraction review) ───
  async function handleProvisionBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Client not created yet — please complete Step 1 first.");
      return;
    }
    setError(""); setLoading(true);
    try {
      const payload: Record<string, string> = {};
      BS_FIELDS.forEach(f => { payload[f.key] = bsForm[f.key] || ""; });
      payload.sector = payload.sector || sector || "";

      // brand_name is required — catch it client-side before wasting a round-trip
      if (!payload.brand_name.trim()) {
        setError("Brand Name is required.");
        setLoading(false);
        return;
      }

      console.log(`POSTing brand system for client ${clientId} to ${API}/api/admin/clients/${clientId}/brand-system`, payload);

      const r = await fetch(`${API}/api/admin/clients/${clientId}/brand-system`, {
        method: "POST", headers: tok(),
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        // Pydantic 422 returns detail as an array
        const detail = Array.isArray(body.detail)
          ? body.detail.map((d: any) => `${d.loc?.slice(-1)[0] ?? "field"}: ${d.msg}`).join(" | ")
          : body.detail || `HTTP ${r.status} error`;
        throw new Error(detail);
      }

      setStep(3);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ── Step 3 → provision login ─────────────────────────────────────────
  async function handleProvisionUser(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/clients/${clientId}/users`, {
        method: "POST", headers: tok(),
        body: JSON.stringify({ email, password, full_name: fullName || null }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "Failed to create user");
      setSuccess("Client fully provisioned — organisation, brand system, and login created.");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  function reset() {
    setStep(1); setCompanyName(""); setSector("");
    setBsForm({}); setBsMode("manual");
    setFiles([]); setImportStep("upload");
    setEmail(""); setPassword(""); setFullName("");
    setClientId(null); setSuccess(""); setError("");
  }

  const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

  return (
    <div className="dashboard-root">
      {/* Dark admin sidebar */}
      <aside className="sidebar" style={{ background: "linear-gradient(180deg, #0f1923 0%, #131f2e 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="sidebar-brand" style={{ background: "rgba(42,82,152,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 16px" }}>
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%", filter: "brightness(1.8)" }} />
          <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "rgba(253,211,53,0.8)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
            Admin Panel
          </div>
        </div>
        <nav className="sidebar-nav" style={{ padding: "16px 10px" }}>
          {NAV_ADMIN.map(n => (
            <a key={n.path} href={n.path} id={`nav-${n.label.toLowerCase()}`}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2, textDecoration: "none", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", background: "transparent", border: "1px solid transparent", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#fdd335"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.55)"; }}
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span style={{ fontSize: "1rem" }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <button style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          onClick={() => { logout(); window.location.href = "/login"; }}>
          ⎋ Sign Out
        </button>
      </aside>

      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 700 }}>
          <header className="dash-header" style={{ marginBottom: 24 }}>
            <div>
              <h1 className="dash-title">New Client Account</h1>
              <p className="dash-subtitle">Step {step} of 3 — {STEP_LABELS[step - 1]}</p>
            </div>
          </header>

          {/* Progress bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {([1, 2, 3] as const).map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? "var(--accent)" : "var(--bg3)", transition: "background 0.3s" }} />
            ))}
          </div>

          {error && <div style={{ background: "rgba(192,57,43,.08)", border: "1px solid rgba(192,57,43,.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "var(--danger)", fontSize: 14 }}>{error}</div>}

          {success && (
            <div style={{ background: "rgba(46,125,94,.08)", border: "1px solid rgba(46,125,94,.2)", borderRadius: 8, padding: "16px", marginBottom: 16, color: "var(--success)", fontSize: 14 }}>
              ✅ {success}
              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button className="btn-primary" id="btn-view-clients" onClick={() => nav("/admin/clients")}>View all clients</button>
                <button className="btn-ghost" id="btn-add-another" onClick={reset}>Add another</button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Organisation ─────────────────────────────────────── */}
          {step === 1 && !success && (
            <form className="result-card" onSubmit={handleCreateClient} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="form-label" htmlFor="company-name">Company Name <span style={{ color: "var(--danger)" }}>*</span></label>
                <input id="company-name" className="form-input" type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Technopark" />
              </div>
              <div>
                <label className="form-label" htmlFor="sector">Sector <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
                <input id="sector" className="form-input" type="text" value={sector} onChange={e => setSector(e.target.value)} placeholder="e.g. Technology, Finance" />
              </div>
              <button id="btn-create-org" type="submit" className="btn-primary" disabled={loading} style={{ alignSelf: "flex-start", minWidth: 180 }}>
                {loading ? "Creating…" : "Create Organisation →"}
              </button>
            </form>
          )}

          {/* ── STEP 2: Brand System ─────────────────────────────────────── */}
          {step === 2 && !success && (
            <div>
              {/* Mode tabs */}
              <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
                {(["manual", "import"] as BsMode[]).map(m => (
                  <button key={m} onClick={() => { setBsMode(m); setError(""); }} style={{
                    padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: bsMode === m ? "var(--accent)" : "transparent",
                    color: bsMode === m ? "#fff" : "var(--text-muted)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
                  }}>
                    {m === "manual" ? "✏️ Manual Input" : "📄 Upload PDF / Doc"}
                  </button>
                ))}
              </div>

              {/* ── MANUAL MODE ── */}
              {bsMode === "manual" && (
                <form className="result-card" onSubmit={handleProvisionBrand} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                    Fill in the brand governance parameters — all fields can be edited after creation.
                  </p>
                  {BS_FIELDS.map(f => (
                    <div key={f.key}>
                      <label className="form-label" htmlFor={`bs-${f.key}`}>
                        {f.label} {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
                        {!f.required && <span style={{ color: "var(--text-dim)", fontWeight: 400, textTransform: "none" }}> (optional)</span>}
                      </label>
                      {f.rows === 1
                        ? <input id={`bs-${f.key}`} className="form-input" type="text" required={f.required}
                            value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.ph} />
                        : <textarea id={`bs-${f.key}`} className="form-textarea form-input" rows={f.rows} required={f.required}
                            style={{ minHeight: f.rows * 24 + 18 }}
                            value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.ph} />
                      }
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    <button type="button" className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
                    <button id="btn-save-brand-manual" type="submit" className="btn-primary" disabled={loading} style={{ minWidth: 180 }}>
                      {loading ? "Saving…" : "Save Brand System →"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── IMPORT MODE ── */}
              {bsMode === "import" && (
                <div className="result-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Upload zone */}
                  {importStep === "upload" && (
                    <>
                      <div
                        className={`import-dropzone${dragging ? " dragging" : ""}`}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                        onClick={() => fileRef.current?.click()}
                      >
                        <div className="dropzone-icon">📄</div>
                        <p className="dropzone-title">{dragging ? "Drop to add…" : "Drag your brand documents here"}</p>
                        <p className="dropzone-sub">or click to browse</p>
                        <p className="dropzone-hint">PDF · DOCX · TXT · MD — multiple files accepted</p>
                        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md"
                          style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
                      </div>

                      {files.length > 0 && (
                        <div>
                          <p className="result-section-title">{files.length} file{files.length > 1 ? "s" : ""} selected</p>
                          {files.map(f => (
                            <div key={f.name} className="import-file-row">
                              <span className="import-file-icon">{f.name.endsWith(".pdf") ? "📕" : f.name.endsWith(".docx") ? "📘" : "📄"}</span>
                              <span className="import-file-name">{f.name}</span>
                              <span className="import-file-size">{fmtSize(f.size)}</span>
                              <button className="import-file-rm" onClick={e => { e.stopPropagation(); setFiles(p => p.filter(x => x.name !== f.name)); }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {extracting && (
                        <div className="import-progress-card">
                          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 3, borderTopColor: "var(--accent)" }} />
                          <div>
                            <p style={{ fontWeight: 500, color: "var(--text)", fontSize: 14 }}>AI extraction in progress…</p>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                              Text extraction → AI analysis → Field structuring
                            </p>
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
                        <button className="btn-primary" onClick={handleExtract} disabled={extracting || !files.length} style={{ minWidth: 200 }}>
                          {extracting ? <><span className="spinner spinner-sm" style={{ borderTopColor: "#fff" }} /> Extracting…</> : "🔍 Extract Brand Data"}
                        </button>
                      </div>
                    </>
                  )}

                  {/* Review / edit extracted data */}
                  {(importStep === "review" || importStep === "saving") && (
                    <form onSubmit={handleProvisionBrand} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {/* Extraction summary banner */}
                      <div className="import-summary-card" style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)" }}>Sources</p>
                            <p style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{sources.join(", ")}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)" }}>Extracted</p>
                            <p style={{ fontSize: 13, color: "var(--text)", marginTop: 2 }}>{charCount.toLocaleString()} characters</p>
                          </div>
                          <span style={{ marginLeft: "auto", background: "rgba(46,125,94,0.1)", color: "#2e7d5e", border: "1px solid rgba(46,125,94,0.25)", borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                            ✓ Extraction complete
                          </span>
                        </div>
                        {warnings.length > 0 && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(176,125,40,0.06)", border: "1px solid rgba(176,125,40,0.2)", borderRadius: "var(--radius-xs)" }}>
                            {warnings.map((w, i) => <p key={i} style={{ fontSize: 12, color: "var(--warn)" }}>⚠ {w}</p>)}
                          </div>
                        )}
                      </div>

                      <p className="result-section-title">Review & adjust extracted fields</p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {BS_FIELDS.map(f => (
                          <div key={f.key}>
                            <label className="form-label" htmlFor={`imp-${f.key}`}>
                              {f.label} {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
                            </label>
                            {f.rows === 1
                              ? <input id={`imp-${f.key}`} className="form-input" type="text" required={f.required}
                                  value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  placeholder={f.ph} />
                              : <textarea id={`imp-${f.key}`} className="form-textarea form-input" rows={f.rows}
                                  style={{ minHeight: f.rows * 24 + 18 }}
                                  value={bsForm[f.key] || ""} onChange={e => setBsForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  placeholder={f.ph} />
                            }
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                        <button type="button" className="btn-ghost" onClick={() => setImportStep("upload")}>← Re-upload</button>
                        <button id="btn-save-brand-import" type="submit" className="btn-primary" disabled={loading || importStep === "saving"} style={{ minWidth: 200 }}>
                          {loading ? <><span className="spinner spinner-sm" style={{ borderTopColor: "#fff" }} /> Saving…</> : "💾 Save Brand System →"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Credentials ──────────────────────────────────────── */}
          {step === 3 && !success && (
            <form className="result-card" onSubmit={handleProvisionUser} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                These credentials will be used by the client to log in to their panel.
              </p>
              <div>
                <label className="form-label" htmlFor="user-email">Email <span style={{ color: "var(--danger)" }}>*</span></label>
                <input id="user-email" className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="client@company.com" />
              </div>
              <div>
                <label className="form-label" htmlFor="user-password">Password <span style={{ color: "var(--danger)" }}>*</span></label>
                <input id="user-password" className="form-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
              </div>
              <div>
                <label className="form-label" htmlFor="user-fullname">Full Name <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(optional)</span></label>
                <input id="user-fullname" className="form-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Marie Dupont" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
                <button id="btn-provision-user" type="submit" className="btn-primary" disabled={loading} style={{ minWidth: 160 }}>
                  {loading ? "Creating…" : "Provision Login ✓"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
