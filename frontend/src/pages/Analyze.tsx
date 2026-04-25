import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getBrandSystems, postAnalyze } from "../services/brandSystems";

const STEPS = ["Brand System", "Message", "Metadata"];
const LANGUAGES = ["fr", "en", "es", "de", "ar", "pt"];
const CHANNELS  = ["Email", "LinkedIn", "Press Release", "Website", "Internal", "Social Media", "Other"];
const CONTENT_TYPES = ["Communication", "Article", "Speech", "Advertisement", "Report", "Other"];

interface BS { id: number; brand_name: string; version: number; }

export default function Analyze() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [brandSystems, setBrandSystems] = useState<BS[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [bsId, setBsId]         = useState<number | "">("");
  const [title, setTitle]       = useState("");
  const [body, setBody]         = useState("");
  const [language, setLanguage] = useState("fr");
  const [channel, setChannel]   = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [contentType, setContentType] = useState("");
  const [author, setAuthor]     = useState("");
  const [campaign, setCampaign] = useState("");

  useEffect(() => { getBrandSystems().then(setBrandSystems); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bsId || !title || !body) { setError("Brand system, title and message are required."); return; }
    setLoading(true); setError("");
    try {
      const result = await postAnalyze({
        brand_system_id: bsId, message_title: title, message_body: body,
        message_language: language, channel: channel || null, audience: audience || null,
        objective: objective || null, content_type: contentType || null,
        author: author || null, campaign: campaign || null,
      });
      nav(`/analysis/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading(false);
    }
  };

  const canNext = step === 0 ? !!bsId : step === 1 ? !!(title && body) : true;

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Analysis</h1>
          <p className="page-sub">Evaluate a message against your Brand System</p>
        </div>
        <a href="/" className="back-link">← Dashboard</a>
      </div>

      {/* Step indicator */}
      <div className="step-indicator">
        {STEPS.map((s, i) => (
          <div key={i} className={`step-dot${i === step ? " active" : i < step ? " done" : ""}`}>
            <span className="step-num">{i < step ? "✓" : i + 1}</span>
            <span className="step-label">{s}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="analyze-form">

        {/* STEP 0 — Brand System */}
        {step === 0 && (
          <div className="step-panel">
            <h2 className="step-title">Select Brand System</h2>
            {brandSystems.length === 0 ? (
              <div className="empty-cta">
                <p>No brand systems yet.</p>
                <a href="/brand-system/new" className="btn-primary">Create your first Brand System →</a>
              </div>
            ) : (
              <div className="bs-cards">
                {brandSystems.map(bs => (
                  <div
                    key={bs.id}
                    className={`bs-card${bsId === bs.id ? " selected" : ""}`}
                    onClick={() => setBsId(bs.id)}
                    id={`bs-card-${bs.id}`}
                  >
                    <p className="bs-card-name">{bs.brand_name}</p>
                    <p className="bs-card-version">v{bs.version}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — Message */}
        {step === 1 && (
          <div className="step-panel">
            <h2 className="step-title">Message to Evaluate</h2>
            <div className="form-field field-full">
              <label className="form-label">Title <span className="required-star">*</span></label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Message title" required />
            </div>
            <div className="form-field field-full">
              <label className="form-label">Language</label>
              <select className="form-input" value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-field field-full">
              <label className="form-label">Message <span className="required-star">*</span></label>
              <textarea className="form-textarea" rows={10} value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Paste the full message here…" required />
            </div>
          </div>
        )}

        {/* STEP 2 — Metadata */}
        {step === 2 && (
          <div className="step-panel">
            <h2 className="step-title">Context <span className="optional-tag">(optional)</span></h2>
            <div className="form-grid">
              {[
                { label: "Channel", val: channel, set: setChannel, opts: CHANNELS },
                { label: "Content Type", val: contentType, set: setContentType, opts: CONTENT_TYPES },
              ].map(f => (
                <div key={f.label} className="form-field field-inline">
                  <label className="form-label">{f.label}</label>
                  <select className="form-input" value={f.val} onChange={e => f.set(e.target.value)}>
                    <option value="">— select —</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              {[
                { label: "Audience",  val: audience,  set: setAudience },
                { label: "Objective", val: objective, set: setObjective },
                { label: "Author",    val: author,    set: setAuthor },
                { label: "Campaign",  val: campaign,  set: setCampaign },
              ].map(f => (
                <div key={f.label} className="form-field field-inline">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder={f.label} />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="form-error">❌ {error}</p>}

        <div className="form-actions">
          {step > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setStep(s => s - 1)}>
              ← Back
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(s => s + 1)}
              disabled={!canNext}>
              Next →
            </button>
          ) : (
            <button type="submit" className="btn-primary btn-analyze" disabled={loading || !canNext}>
              {loading ? <><span className="spinner" /> Analysing…</> : "🔍 Analyser"}
            </button>
          )}
        </div>
      </form>

      {/* Full-screen loading overlay */}
      {loading && (
        <div className="analysis-overlay">
          <div className="analysis-loading">
            <span className="spinner spinner-lg" />
            <p>Running brand analysis…</p>
            <p className="overlay-sub">Clarity Engine is evaluating your message</p>
          </div>
        </div>
      )}
    </div>
  );
}
