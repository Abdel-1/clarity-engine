import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnalysis } from "../services/brandSystems";

interface AnalysisData {
  id: number; message_title: string; brand_system_name: string;
  message_language: string; channel: string; content_type: string;
  clarity_score: number; sub_clarity: number; sub_alignment: number;
  sub_focus: number; sub_tone: number; sub_narrative_contribution: number;
  points_forts: string[]; points_faibles: string[]; recommandations: string[];
  analyzed_at: string; parent_analysis_id: number | null;
}

const scoreColor = (n: number, max: number) => {
  const p = n / max;
  return p >= 0.75 ? "#2e7d5e" : p >= 0.5 ? "#b07d28" : "#c0392b";
};
const scoreClass = (n: number, max: number) => {
  const p = n / max;
  return p >= 0.75 ? "good" : p >= 0.5 ? "warn" : "bad";
};

const SUBS = [
  { key: "sub_clarity",               label: "Readability" },
  { key: "sub_alignment",             label: "Alignment" },
  { key: "sub_focus",                 label: "Focus" },
  { key: "sub_tone",                  label: "Tone" },
  { key: "sub_narrative_contribution",label: "Narrative" },
];

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [data, setData]       = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!id) return;
    getAnalysis(id).then(setData).catch(() => setError("Analysis not found")).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading"><span className="spinner spinner-lg" /> Loading…</div>;
  if (!data) return (
    <div style={{ padding: 40 }}>
      <div className="empty-cta">
        <p>{error}</p>
        <a href="/analyze" className="btn-primary">New Analysis →</a>
      </div>
    </div>
  );

  const score = data.clarity_score;
  const r = 72; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const ringColor = scoreColor(score, 100);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "28px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div className="page-header no-print">
          <div>
            <h1 className="page-title">{data.message_title}</h1>
            <p className="page-sub">{data.brand_system_name} · {data.analyzed_at?.slice(0, 10)}</p>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" onClick={() => window.print()}>🖨 Export PDF</button>
            <a href="/analyze" className="btn-primary" onClick={e => { e.preventDefault(); nav("/analyze"); }}>
              + Nouvelle analyse
            </a>
          </div>
        </div>

        <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>

          {/* Card header — no risk badge */}
          <div style={{
            padding: "14px 18px", display: "flex", alignItems: "center",
            background: "linear-gradient(135deg, #fdd335 0%, #2a5298 100%)"
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Analyse de Communication
            </span>
          </div>

          {/* Score ring + bar */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 20 }}>
            <div className="score-ring-wrap" style={{ width: 176, height: 176 }}>
              <svg width="176" height="176" viewBox="0 0 176 176">
                <circle cx="88" cy="88" r={r} fill="none" stroke="var(--bg3)" strokeWidth="12" />
                <circle cx="88" cy="88" r={r} fill="none" stroke={ringColor} strokeWidth="12"
                  strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                  transform="rotate(-90 88 88)" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="score-ring-text">
                <span style={{ color: ringColor, fontFamily: "'Lora',serif", fontSize: "2.2rem", fontWeight: 600, lineHeight: 1 }}>{score}</span>
                <span className="score-denom">/100</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)", marginBottom: 8 }}>
                Score Global de Communication
              </p>
              <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${score}%`, background: ringColor, borderRadius: 4, transition: "width 1s ease" }} />
              </div>
              <span style={{ fontSize: 13, color: ringColor, fontWeight: 600 }}>{score}/100</span>
              {data.parent_analysis_id && (
                <span style={{ marginLeft: 12, fontSize: 11, color: "var(--text-dim)" }}>
                  📈 Message réécrit et ré-analysé
                </span>
              )}
            </div>
          </div>

          {/* 5 subscores — all /20 */}
          <div className="analysis-scores">
            {SUBS.map(s => {
              const val = data[s.key as keyof AnalysisData] as number;
              return (
                <div key={s.key} className="score-cell">
                  <p className="score-label-sm">{s.label}</p>
                  <p className={`score-val ${scoreClass(val, 20)}`} style={{ fontSize: "1.3rem" }}>
                    {val}<span style={{ fontSize: "0.6em", fontWeight: 400, color: "var(--text-dim)" }}>/20</span>
                  </p>
                  <div className="score-bar-mini">
                    <div className="score-bar-fill" style={{ width: `${(val / 20) * 100}%`, background: scoreColor(val, 20) }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Points */}
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
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

          {/* Meta strip */}
          <div style={{ display: "flex", gap: 14, padding: "10px 18px", background: "var(--bg3)", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            {[
              { label: "Brand System", val: data.brand_system_name },
              { label: "Langue", val: data.message_language?.toUpperCase() },
              { label: "Canal", val: data.channel || "—" },
              { label: "Type", val: data.content_type || "—" },
              { label: "Date", val: data.analyzed_at?.slice(0, 10) },
            ].map(m => (
              <span key={m.label} style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 4 }}>
                {m.label}: <strong style={{ color: "var(--text-muted)", fontWeight: 500 }}>{m.val}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="result-footer no-print" style={{ marginTop: 16 }}>
          <a href="/history" className="btn-ghost" onClick={e => { e.preventDefault(); nav("/history"); }}>← Historique</a>
          <a href="/analyze" className="btn-primary" onClick={e => { e.preventDefault(); nav("/analyze"); }}>+ Nouvelle analyse</a>
        </div>
      </div>
    </div>
  );
}
