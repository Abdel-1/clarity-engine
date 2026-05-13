import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnalysis } from "../services/brandSystems";
import { isAdmin, logout } from "../services/auth";
import logoSvg from "../assets/logo.svg";

interface AnalysisData {
  id: number; message_title: string; brand_system_name: string;
  message_language: string; channel: string; content_type: string;
  clarity_score: number; sub_clarity: number; sub_alignment: number;
  sub_focus: number; sub_tone: number; sub_narrative_contribution: number;
  narrative_risk: "Low" | "Medium" | "High";
  points_forts: string[]; points_faibles: string[]; recommandations: string[];
  analyzed_at: string;
}

const RISK_CLASS = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" } as const;
const scoreClass = (n: number, max: number) => { const p = n / max; return p >= 0.75 ? "good" : p >= 0.5 ? "warn" : "bad"; };
const barColor  = (n: number, max: number) => { const p = n / max; return p >= 0.75 ? "#2e7d5e" : p >= 0.5 ? "#b07d28" : "#c0392b"; };

const NAV_CLIENT = [
  { path: "/",        label: "Dashboard",  icon: "⬡" },
  { path: "/analyze", label: "Analyser",   icon: "✦" },
  { path: "/history", label: "Historique", icon: "◈" },
];
const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",   icon: "◈" },
  { path: "/admin/analytics", label: "Analytics", icon: "✦" },
];

/* ── Print / PDF styles injected inline ── */
const PRINT_STYLE = `
@media print {
  @page { size: A4 portrait; margin: 22mm 18mm; }
  .no-print  { display: none !important; }
  .dashboard-root { display: block !important; height: auto !important; }
  .sidebar    { display: none !important; }
  .dashboard-main { padding: 0 !important; overflow: visible !important; }
  .page-content   { max-width: 100% !important; }
  body { background: #fff !important; color: #111 !important; font-size: 12px; }
  .result-card { box-shadow: none !important; border: 1px solid #ddd !important; }
  .risk-badge  { border: 1px solid #ccc !important; }
}
`;

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData]       = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const admin = isAdmin();

  useEffect(() => {
    if (!id) return;
    getAnalysis(id)
      .then(setData)
      .catch(() => setError("Analysis not found"))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── PDF download: print with suggested filename ── */
  const handlePdf = () => {
    if (!data) return;
    const title = data.message_title.replace(/[^a-z0-9]/gi, "_").slice(0, 50);
    document.title = `Clarity_Report_${title}_${data.analyzed_at?.slice(0, 10)}`;
    window.print();
    // Restore title after print dialog closes
    setTimeout(() => { document.title = "Clarity Engine"; }, 2000);
  };

  const navItems = admin ? NAV_ADMIN : NAV_CLIENT;

  if (loading) return (
    <div className="dashboard-root">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-dim)", gap: 12 }}>
        <span className="spinner spinner-lg" /> Loading analysis…
      </div>
    </div>
  );

  if (!data) return (
    <div className="dashboard-root">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div className="empty-cta">
          <p>{error || "Analysis not found."}</p>
          <a href="/history" className="btn-primary" onClick={e => { e.preventDefault(); nav("/history"); }}>← Back to History</a>
        </div>
      </div>
    </div>
  );

  const subs = [
    { label: "Clarity",   val: data.sub_clarity },
    { label: "Alignment", val: data.sub_alignment },
    { label: "Focus",     val: data.sub_focus },
    { label: "Tone",      val: data.sub_tone },
    { label: "Narrative", val: data.sub_narrative_contribution },
  ];

  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ - (data.clarity_score / 100) * circ;
  const ringColor = data.clarity_score >= 75 ? "#2e7d5e" : data.clarity_score >= 50 ? "#b07d28" : "#c0392b";

  return (
    <div className="dashboard-root">
      {/* Inject print styles */}
      <style>{PRINT_STYLE}</style>

      {/* Sidebar */}
      <aside className="sidebar no-print">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
        </div>
        <nav className="sidebar-nav">
          <div style={{ marginBottom: 6, padding: "0 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.9px" }}>
            Navigation
          </div>
          {navItems.map(n => (
            <a key={n.path} href={n.path}
              className="nav-item"
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span style={{ fontSize: "0.9rem" }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>
          Sign Out
        </button>
      </aside>

      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 860 }}>

          {/* Header — no-print on buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              {/* Print-only header */}
              <div className="print-only" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #2a5298" }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#2a5298", marginBottom: 4 }}>
                  Clarity Engine — Brand Governance Report
                </p>
              </div>
              <h1 className="dash-title" style={{ fontSize: 18, lineHeight: 1.4, marginBottom: 4 }}>{data.message_title}</h1>
              <p className="dash-subtitle">{data.brand_system_name} · {data.analyzed_at?.slice(0, 10)}</p>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button id="btn-download-pdf" className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 7 }}
                onClick={handlePdf}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
              <a href="/analyze" className="btn-primary"
                onClick={e => { e.preventDefault(); nav("/analyze"); }}>
                + Nouvelle analyse
              </a>
            </div>
          </div>

          {/* Analysis card */}
          <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>

            {/* Card header gradient */}
            <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #fdd335 0%, #2a5298 100%)" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Analyse de Communication
              </span>
              <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}
                style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
                {data.narrative_risk} Risk
              </span>
            </div>

            {/* Score ring */}
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 24 }}>
              <div className="score-ring-wrap" style={{ width: 176, height: 176, flexShrink: 0 }}>
                <svg width="176" height="176" viewBox="0 0 176 176">
                  <circle cx="88" cy="88" r={r} fill="none" stroke="var(--bg3)" strokeWidth="12" />
                  <circle cx="88" cy="88" r={r} fill="none" stroke={ringColor} strokeWidth="12"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                    transform="rotate(-90 88 88)" style={{ transition: "stroke-dashoffset 1s ease" }} />
                </svg>
                <div className="score-ring-text">
                  <span className="score-number" style={{ color: ringColor, fontFamily: "'Lora',serif", fontSize: "2.2rem", fontWeight: 600 }}>{data.clarity_score}</span>
                  <span className="score-denom">/100</span>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)", marginBottom: 6 }}>Clarity Score Global</p>
                <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ height: "100%", width: `${data.clarity_score}%`, background: ringColor, borderRadius: 4, transition: "width 1s ease" }} />
                </div>
                <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}>{data.narrative_risk} Risk</span>

                {/* Meta inline for print */}
                <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Brand System", val: data.brand_system_name },
                    { label: "Language",     val: data.message_language?.toUpperCase() },
                    { label: "Channel",      val: data.channel || "—" },
                    { label: "Type",         val: data.content_type || "—" },
                  ].map(m => (
                    <span key={m.label} style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 5, alignItems: "center" }}>
                      {m.label}: <strong style={{ color: "var(--text-muted)", fontWeight: 500 }}>{m.val}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 5 subscores grid */}
            <div className="analysis-scores">
              {subs.map(s => (
                <div key={s.label} className="score-cell">
                  <p className="score-label-sm">{s.label}</p>
                  <p className={`score-val ${scoreClass(s.val, 20)}`}>{s.val}</p>
                  <div className="score-bar-mini">
                    <div className="score-bar-fill" style={{ width: `${(s.val / 20) * 100}%`, background: barColor(s.val, 20) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Points / Recommandations */}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              {data.points_forts?.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-dim)", marginBottom: 8 }}>Points Forts</p>
                  {data.points_forts.map((p, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", background: "rgba(46,125,94,0.06)", borderLeft: "2.5px solid #2e7d5e", marginBottom: 6 }}>{p}</div>
                  ))}
                </div>
              )}
              {data.points_faibles?.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-dim)", marginBottom: 8 }}>Points Faibles</p>
                  {data.points_faibles.map((p, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", background: "rgba(176,125,40,0.06)", borderLeft: "2.5px solid #b07d28", marginBottom: 6 }}>{p}</div>
                  ))}
                </div>
              )}
              {data.recommandations?.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-dim)", marginBottom: 8 }}>Recommandations</p>
                  {data.recommandations.map((r, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderRadius: "var(--radius-xs)", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", background: "var(--accent-dim)", borderLeft: "2.5px solid var(--accent)", marginBottom: 6 }}>{r}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Print footer */}
            <div className="print-only" style={{ padding: "12px 18px", borderTop: "1px solid #ddd", fontSize: 10, color: "#999", display: "flex", justifyContent: "space-between" }}>
              <span>Generated by Clarity Engine · Zone Bleue</span>
              <span>Analyzed: {data.analyzed_at?.slice(0, 10)}</span>
            </div>
          </div>

          {/* Footer nav buttons — hidden from print */}
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <a href="/history" className="btn-ghost"
              onClick={e => { e.preventDefault(); nav("/history"); }}>
              ← Historique
            </a>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-ghost" onClick={handlePdf} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
              <a href="/analyze" className="btn-primary"
                onClick={e => { e.preventDefault(); nav("/analyze"); }}>
                + Nouvelle analyse
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
