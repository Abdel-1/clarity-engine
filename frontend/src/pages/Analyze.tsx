import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getBrandSystems, postAnalyze, getAnalysisAccess } from "../services/brandSystems";
import type { AnalysisAccess } from "../services/brandSystems";
import AppSidebar from "../components/AppSidebar";
import Select from "../components/Select";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";

/** Consume the /analyze/stream SSE endpoint: calls onToken for each delta, and
 *  resolves with the final validated payload from the 'done' event. Throws on
 *  any error so the caller can fall back to the classic /analyze. */
async function streamAnalyze(
  payload: Record<string, unknown>,
  onToken: (t: string) => void,
): Promise<any> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done: any = null;
  let errDetail: string | null = null;

  for (;;) {
    const { value, done: rdDone } = await reader.read();
    if (rdDone) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {       // SSE frames split on blank line
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: any;
      try { parsed = JSON.parse(data); } catch { continue; }
      if (event === "token") onToken(parsed.t ?? "");
      else if (event === "done") done = parsed;
      else if (event === "error") errDetail = parsed.detail ?? "stream error";
    }
  }
  if (errDetail) throw new Error(errDetail);
  if (!done) throw new Error("stream ended without result");
  return done;
}

/* ── Types ───────────────────────────────────────────────────────────── */
interface BS { id: number; brand_name: string; version: number; }
interface PointItem { text: string; evidence?: string }
interface RecoItem  { text: string; brand_element?: string }
const _txt  = (p: string | PointItem): string  => typeof p === "string" ? p : p.text;

interface AnalysisResult {
  id: number;
  message_title: string;
  brand_system_name: string;
  clarity_score: number;
  sub_lisibilite: number;
  sub_alignment: number;
  sub_focus: number;
  sub_tone: number;
  sub_narrative_contribution: number;
  narrative_risk: string;
  points_forts: (string | PointItem)[];
  points_faibles: (string | PointItem)[];
  recommandations: (string | RecoItem)[];
  message_body?: string;
  conversation_id?: string;
  brand_mismatch?: boolean;
  brand_mismatch_note?: string;
}

/** One conversation turn: the submitted message + its analysis result. */
interface ChatTurn {
  key: string;
  user: { text: string; channel?: string; type?: string; audience?: string };
  result: AnalysisResult;
}

const NAV = [
  { path: "/",        label: "Tableau de bord", icon: "⬡" },
  { path: "/analyze", label: "Analyser",         icon: "✦" },
  { path: "/history", label: "Historique",       icon: "◷" },
];

const CONTENT_TYPES = [
  "Post Réseaux Sociaux", "Email Marketing / Newsletter", "Email Interne",
  "Communiqué de Presse", "Article de Blog", "Publicité / Ad Copy",
  "Présentation / Deck", "Rapport / Report", "Discours / Speech",
  "Script Vidéo / Podcast / Audio",
];
const CHANNELS = [
  "LinkedIn", "Instagram", "Twitter / X", "Facebook",
  "Site Web / Website", "Email Externe / Marketing Email",
  "Presse / Media", "TikTok", "YouTube / Vidéo", "Podcast",
  "Affichage / OOH / Billboard",
];
const AUDIENCES = [
  "Grand Public", "C-Suite / Dirigeants", "Clients / Customers",
  "Prospects / Leads", "Experts / Professionnels", "Jeunes / Youth (18–35)",
  "Partenaires / Partners", "Médias / Journalistes", "Investisseurs / Investors",
];
const OBJECTIVES = [
  "Notoriété / Brand Awareness", "Conversion / Vente",
  "Fidélisation / Retention", "Engagement / Communauté",
  "Éducation / Information", "Recrutement / Employer Branding",
  "Lancement Produit / Service Launch", "Gestion de Crise",
  "Partenariat / Partnership Announcement", "RSE / Sustainability / Purpose",
];

/* ── Risk badge ───────────────────────────────────────────────────────── */
function RiskBadge({ risk }: { risk: string }) {
  const k = (risk || "").toLowerCase();
  const isLow    = k === "low"    || k === "faible";
  const isHigh   = k === "high"   || k === "eleve" || k === "élevé";
  const color    = isLow ? "#4ade80" : isHigh ? "#f87171" : "#fb923c";
  const bg       = isLow ? "rgba(74,222,128,.12)" : isHigh ? "rgba(248,113,113,.12)" : "rgba(251,146,60,.12)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: bg, color, border: `1px solid ${color}40`,
      borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {risk}
    </span>
  );
}

/* ── Score bar ───────────────────────────────────────────────────────── */
function ScoreBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? "#4ade80" : pct >= 50 ? "#fb923c" : "#f87171";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value} <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>/ {max}</span></span>
      </div>
      <div style={{ height: 4, background: "var(--az-track)", borderRadius: 100, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 100, transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

/* ── Result bubble ───────────────────────────────────────────────────── */
function ResultBubble({ result, onReset, nav }: {
  result: AnalysisResult;
  onReset?: () => void;
  nav: ReturnType<typeof useNavigate>;
}) {
  const totalScore = result.clarity_score;
  const scoreColor = totalScore >= 75 ? "#4ade80" : totalScore >= 55 ? "#fb923c" : "#f87171";

  return (
    <div className="chat-result-bubble" style={{ animation: "slideUp .4s cubic-bezier(.4,0,.2,1)" }}>
      {/* AI avatar header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, boxShadow: "0 0 16px rgba(201,164,73,.3)",
        }}>✦</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Clarity Engine</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Analyse terminée · {result.brand_system_name}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: "5px 12px" }}
            onClick={() => nav(`/analysis/${result.id}`)}
          >
            Rapport complet →
          </button>
          {onReset && (
            <button
              className="btn-primary"
              style={{ fontSize: 11, padding: "5px 14px" }}
              onClick={onReset}
            >
              + Nouvelle analyse
            </button>
          )}
        </div>
      </div>

      {/* Brand-ownership notice — message belongs to a different brand (non-scoring) */}
      {result.brand_mismatch && result.brand_mismatch_note && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
          background: "rgba(248,113,113,.10)", border: "1px solid rgba(248,113,113,.35)",
          borderRadius: 10, padding: "11px 14px",
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f87171", lineHeight: 1.45 }}>
            {result.brand_mismatch_note}
          </span>
        </div>
      )}

      {/* Score ring + subscores */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 24, marginBottom: 20 }}>
        {/* Ring */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 110, height: 110 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="var(--az-track)" strokeWidth="10" />
              <circle
                cx="55" cy="55" r="46"
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - totalScore / 100)}`}
                transform="rotate(-90 55 55)"
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 6px ${scoreColor}80)` }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{totalScore}</span>
              <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>/ 100</span>
            </div>
          </div>
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <RiskBadge risk={result.narrative_risk} />
          </div>
        </div>

        {/* Sub-scores */}
        <div style={{ paddingTop: 4 }}>
          <ScoreBar label="Clarity"                 value={result.sub_lisibilite} />
          <ScoreBar label="Alignment"               value={result.sub_alignment} />
          <ScoreBar label="Focus"                   value={result.sub_focus} />
          <ScoreBar label="Tone"                    value={result.sub_tone} />
          <ScoreBar label="Narrative Contribution"  value={result.sub_narrative_contribution} />
        </div>
      </div>

      {/* Lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Points forts",   items: result.points_forts,    color: "#4ade80", icon: "✓" },
          { label: "Points faibles", items: result.points_faibles,  color: "#f87171", icon: "✗" },
          { label: "Recommandations",items: result.recommandations, color: "#c9a449", icon: "→" },
        ].map(({ label, items, color, icon }) => (
          <div key={label} style={{
            background: "var(--az-inset-soft)", borderRadius: 10,
            border: "1px solid var(--az-line)", padding: "12px 14px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-dim)", marginBottom: 10 }}>{label}</div>
            {items?.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12, color: "var(--text-body)", lineHeight: 1.5 }}>
                <span style={{ color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <span>{_txt(item)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Custom dropdown ──────────────────────────────────────────────────── */
function ChipSelect({ label, value, options, onChange, id }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; id: string;
}) {
  const [open, setOpen]           = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [hovered, setHovered]     = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset when parent clears value (reset button)
  useEffect(() => {
    if (value === "") { setOtherMode(false); setCustomText(""); }
  }, [value]);

  const pick = (v: string) => {
    if (v === "__other__") {
      setOtherMode(true);
      setCustomText("");
      onChange("");
    } else {
      setOtherMode(false);
      setCustomText("");
      onChange(v);
    }
    setOpen(false);
  };

  const handleCustom = (text: string) => {
    setCustomText(text);
    onChange(text);
  };

  const displayLabel = otherMode
    ? (customText || "Autre (préciser...)")
    : value || `— ${label} —`;
  const hasValue = otherMode ? customText.length > 0 : value.length > 0;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <label htmlFor={id} style={{
        fontSize: 10, fontWeight: 700, color: "var(--text-dim)",
        display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1,
      }}>{label}</label>

      {/* Trigger button */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: hasValue ? "rgba(201,164,73,.07)" : "var(--az-inset)",
          border: `1px solid ${open ? "rgba(201,164,73,.4)" : hasValue ? "rgba(201,164,73,.25)" : "var(--az-line)"}`,
          borderRadius: otherMode && !open ? "8px 8px 0 0" : 8,
          padding: "7px 10px", fontSize: 12, textAlign: "left", cursor: "pointer",
          color: hasValue ? "var(--text-primary)" : "var(--text-dim)",
          outline: "none", fontFamily: "inherit",
          transition: "border-color .15s, background .15s",
          boxShadow: open ? "0 0 0 2px rgba(201,164,73,.12)" : "none",
        }}
      >
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: otherMode && !customText ? "var(--text-dim)" : undefined,
        }}>{displayLabel}</span>
        <svg
          style={{ flexShrink: 0, marginLeft: 6, transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          width="10" height="6" viewBox="0 0 10 6" fill="none"
        >
          <path d="M1 1L5 5L9 1" stroke={hasValue ? "var(--gold)" : "var(--az-faint)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 100,
          background: "var(--bg-card)",
          border: "1px solid rgba(201,164,73,.25)",
          borderRadius: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,.35), 0 0 0 1px var(--az-line-soft)",
          overflow: "hidden",
          animation: "dropIn .15s cubic-bezier(.4,0,.2,1)",
        }}>
          {/* Empty / placeholder row */}
          <div
            onClick={() => pick("")}
            onMouseEnter={() => setHovered("__empty__")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: "8px 12px", fontSize: 11.5, cursor: "pointer",
              color: "var(--text-dim)",
              background: hovered === "__empty__" ? "var(--az-inset)" : "transparent",
              borderBottom: "1px solid var(--az-line-soft)",
              transition: "background .1s",
            }}
          >— {label} —</div>

          {/* Scrollable option list */}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {options.map(o => {
              const active = !otherMode && value === o;
              return (
                <div
                  key={o}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setHovered(o)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: "8px 12px", fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: active
                      ? "rgba(201,164,73,.12)"
                      : hovered === o ? "var(--az-inset)" : "transparent",
                    color: active ? "var(--gold)" : "var(--text-body)",
                    fontWeight: active ? 600 : 400,
                    transition: "background .1s",
                  }}
                >
                  <span>{o}</span>
                  {active && (
                    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                      <path d="M1 4L4.5 7.5L11 1" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* Autre option */}
          <div
            onClick={() => pick("__other__")}
            onMouseEnter={() => setHovered("__other__")}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: "8px 12px", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
              borderTop: "1px solid var(--az-line)",
              background: otherMode
                ? "rgba(201,164,73,.10)"
                : hovered === "__other__" ? "rgba(201,164,73,.06)" : "transparent",
              color: "var(--gold)",
              fontWeight: otherMode ? 600 : 400,
              transition: "background .1s",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 10L3.5 7.5M9.5 1.5a1.5 1.5 0 0 0-2.12 0L2 7l-.5 2 2-.5 5.38-5.38a1.5 1.5 0 0 0 0-2.12z" stroke="var(--gold)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Autre (préciser...)
          </div>
        </div>
      )}

      {/* Free-text input shown when "Autre" is selected */}
      {otherMode && (
        <input
          type="text"
          placeholder="Précisez..."
          value={customText}
          onChange={e => handleCustom(e.target.value)}
          autoFocus
          style={{
            width: "100%", marginTop: 6,
            background: "rgba(201,164,73,.05)",
            border: "1px solid rgba(201,164,73,.3)",
            borderRadius: 8, padding: "7px 10px", fontSize: 12,
            color: "var(--text-primary)", outline: "none",
            boxSizing: "border-box" as const, fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
}

/* ── User message bubble ──────────────────────────────────────────────── */
function UserBubble({ text, meta }: { text: string; meta: { channel?: string; type?: string; audience?: string } }) {
  const tags = [meta.channel, meta.type, meta.audience].filter(Boolean);
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <div style={{ maxWidth: "80%" }}>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 6, flexWrap: "wrap" }}>
            {tags.map(t => (
              <span key={t} style={{
                background: "rgba(201,164,73,.12)", color: "var(--gold)",
                border: "1px solid rgba(201,164,73,.2)", borderRadius: 100,
                padding: "2px 10px", fontSize: 11, fontWeight: 600,
              }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1a3050 100%)",
          border: "1px solid rgba(96,165,250,.2)",
          borderRadius: "18px 18px 4px 18px",
          padding: "12px 16px", fontSize: 13.5, color: "#F1F5F9",
          lineHeight: 1.65, whiteSpace: "pre-wrap",
          boxShadow: "0 2px 12px rgba(0,0,0,.2)",
        }}>
          {text}
        </div>
      </div>
    </div>
  );
}


/* ── Streaming "analysis in progress" experience ──────────────────────────
   Replaces the raw-JSON view while the model streams: a glowing assistant,
   evocative analysis stages, the 5 dimensions lighting up, and a live progress
   bar. Progress is driven by streamed-token volume, with a time-based floor so
   it animates even on the non-streamed fallback path. Purely cosmetic. */
const ANALYSIS_STAGES = [
  "Lecture du Brand System…",
  "Évaluation de la clarté et de la lisibilité…",
  "Vérification de l'alignement de marque…",
  "Analyse du focus et du ton…",
  "Détection des signaux narratifs…",
  "Calcul du Clarity Score…",
];
const DIMENSIONS = ["Clarity", "Alignment", "Focus", "Tone", "Narrative"];

function StreamingThinking({ chars, brand }: { chars: number; brand?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 0.1), 100);
    return () => clearInterval(id);
  }, []);

  const timeP    = Math.min(92, (elapsed / 18) * 92);          // time-based floor (~18s)
  const tokenP   = Math.min(95, (chars / 2600) * 100);          // real streamed volume
  const progress = Math.min(95, Math.max(timeP, tokenP));
  const stage    = ANALYSIS_STAGES[Math.min(ANALYSIS_STAGES.length - 1,
                     Math.floor((progress / 100) * ANALYSIS_STAGES.length))];
  const activeDims = Math.round((progress / 95) * DIMENSIONS.length);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
      <style>{`
        @keyframes ceGlow   { 0%,100%{box-shadow:0 0 10px rgba(201,164,73,.35)} 50%{box-shadow:0 0 22px rgba(201,164,73,.75)} }
        @keyframes ceShim   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ceFade   { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
      `}</style>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        animation: "ceGlow 1.6s ease-in-out infinite",
      }}>✦</div>

      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--bg-border)",
        borderRadius: "4px 18px 18px 18px", padding: "16px 18px",
        minWidth: 300, maxWidth: 460, flex: 1,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
          Clarity Engine
        </div>
        <div key={stage} style={{ fontSize: 12, color: "var(--gold)", marginBottom: 14, animation: "ceFade .35s ease" }}>
          {stage}{brand ? `  ·  ${brand}` : ""}
        </div>

        {/* 5 dimensions lighting up as the analysis advances */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {DIMENSIONS.map((d, i) => {
            const active  = i < activeDims;
            const current = i === activeDims;
            return (
              <span key={d} style={{
                fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 100,
                border: `1px solid ${active || current ? "rgba(201,164,73,.4)" : "var(--bg-border)"}`,
                color: active ? "var(--gold)" : current ? "var(--gold)" : "var(--text-dim)",
                background: active ? "rgba(201,164,73,.12)" : "transparent",
                backgroundImage: current
                  ? "linear-gradient(90deg, rgba(201,164,73,.06), rgba(201,164,73,.28), rgba(201,164,73,.06))"
                  : undefined,
                backgroundSize: "200% 100%",
                animation: current ? "ceShim 1.2s linear infinite" : undefined,
                transition: "all .4s ease",
              }}>{d}</span>
            );
          })}
        </div>

        {/* Live progress bar with shimmer */}
        <div style={{ height: 5, borderRadius: 100, background: "var(--az-track)", overflow: "hidden", position: "relative" }}>
          <div style={{
            height: "100%", width: `${progress}%`, borderRadius: 100,
            background: "linear-gradient(90deg, var(--gold-deep), var(--gold))",
            transition: "width .4s ease",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)",
            backgroundSize: "200% 100%", animation: "ceShim 1.5s linear infinite",
          }} />
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "right" }}>
          Analyse en cours… {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}

/* ── Analysis lock screen ─────────────────────────────────────────────────
   Shown in place of the composer when the admin has suspended the engine for
   this member or this brand system. Everything else on the platform still works. */
function AnalysisLock({ scope, message, nav }: {
  scope: "member" | "brand";
  message: string;
  nav: ReturnType<typeof useNavigate>;
}) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, overflowY: "auto" }}>
      <style>{`
        @keyframes lockPulse { 0%,100%{ box-shadow:0 0 0 0 rgba(248,113,113,.30) } 50%{ box-shadow:0 0 0 16px rgba(248,113,113,0) } }
        @keyframes lockFloat { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-4px) } }
        @keyframes lockShackle { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-1.5px) } }
        @keyframes lockIn { from{ opacity:0; transform:translateY(14px) scale(.97) } to{ opacity:1; transform:none } }
      `}</style>
      <div style={{
        maxWidth: 470, width: "100%", textAlign: "center", position: "relative", overflow: "hidden",
        background: "var(--bg-card)", border: "1px solid rgba(248,113,113,.25)",
        borderRadius: 20, padding: "42px 38px 36px", animation: "lockIn .45s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Glow backdrop */}
        <div style={{
          position: "absolute", top: -70, left: "50%", transform: "translateX(-50%)",
          width: 230, height: 230, pointerEvents: "none",
          background: "radial-gradient(circle, rgba(248,113,113,.16), transparent 70%)",
        }} />

        {/* Padlock medallion */}
        <div style={{
          width: 88, height: 88, borderRadius: "50%", margin: "0 auto 24px", position: "relative", zIndex: 1,
          background: "linear-gradient(135deg, rgba(248,113,113,.20), rgba(248,113,113,.05))",
          border: "1px solid rgba(248,113,113,.35)", display: "flex", alignItems: "center", justifyContent: "center",
          animation: "lockPulse 2.4s ease-in-out infinite",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ animation: "lockFloat 3.2s ease-in-out infinite" }}>
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="#f87171" strokeWidth="1.7" strokeLinecap="round" style={{ animation: "lockShackle 3.2s ease-in-out infinite" }} />
            <rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="#f87171" fillOpacity="0.14" stroke="#f87171" strokeWidth="1.7" />
            <circle cx="12" cy="14.7" r="1.7" fill="#f87171" />
            <path d="M12 16.1V18.2" stroke="#f87171" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#f87171", marginBottom: 10, position: "relative", zIndex: 1 }}>
          {scope === "brand" ? "Brand System suspendu" : "Accès membre suspendu"}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px", fontFamily: "'Lora', serif", position: "relative", zIndex: 1 }}>
          Analyse verrouillée
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, margin: "0 0 8px", position: "relative", zIndex: 1 }}>
          {message}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6, margin: "0 0 26px", position: "relative", zIndex: 1 }}>
          Le reste de la plateforme reste accessible — vous pouvez consulter vos analyses et votre historique.
          Contactez votre administrateur pour rétablir l'accès.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", position: "relative", zIndex: 1 }}>
          <button onClick={() => nav("/")} style={{
            background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
            color: "#0B1220", border: "none", borderRadius: 10, padding: "9px 18px",
            fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>⬡ Tableau de bord</button>
          <button onClick={() => nav("/history")} style={{
            background: "var(--az-inset)", color: "var(--text-muted)",
            border: "1px solid var(--az-line)", borderRadius: 10, padding: "9px 18px",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>◷ Historique</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function Analyze() {
  const nav = useNavigate();
  const location = useLocation();

  // Continuation context when arriving from "Continuer l'analyse": the new
  // submission is threaded onto the SAME conversation instead of starting a new one.
  const [continuation, setContinuation] =
    useState<{ conversationId: string; parentId: number | null } | null>(null);
  // Completed conversation turns (chat history), oldest → newest.
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const [brandSystems, setBrandSystems]   = useState<BS[]>([]);
  const [access, setAccess]               = useState<AnalysisAccess | null>(null);
  const [bsId, setBsId]                   = useState<number | "">("");
  const [messageBody, setMessageBody]     = useState("");
  const [messageTitle, setMessageTitle]   = useState("");
  const [contentType, setContentType]     = useState("");
  const [channel, setChannel]             = useState("");
  const [audience, setAudience]           = useState("");
  const [objective, setObjective]         = useState("");
  const [campaign, setCampaign]           = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [, setResult]                     = useState<AnalysisResult | null>(null);  // cleared between turns
  const [streamText, setStreamText]       = useState("");   // live tokens during streaming
  const [sentMessage, setSentMessage]     = useState<{ text: string; channel?: string; type?: string; audience?: string } | null>(null);
  // Context dropdowns are collapsed by default (all fields optional) and re-collapse after each analysis.
  const [contextOpen, setContextOpen]     = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const latestResultRef = useRef<HTMLDivElement>(null);   // newest result → scroll + focus target
  // Guard so a given conversation is restored only once (avoids clobbering edits).
  const appliedConv = useRef<string | null>(null);

  useEffect(() => {
    getBrandSystems().then(list => {
      setBrandSystems(list);
      // Don't override a brand system restored from a continuation.
      if (list.length > 0 && appliedConv.current == null) setBsId(list[0].id);
    });
    // Whether the analysis engine is available for this member / brand systems.
    getAnalysisAccess().then(setAccess).catch(() => setAccess(null));
  }, []);

  // React to every navigation to /analyze (keyed on location.key):
  //  · with continuation state ("Continuer l'analyse") → restore the thread context
  //    so the next submission continues the SAME conversation/message.
  //  · without it ("Nouvelle analyse"/sidebar) → clean slate (no stale threading).
  useEffect(() => {
    const st = location.state as
      | { conversation_id?: string; history?: any[]; returnMessages?: any[] }
      | null;
    const thread = st?.history ?? st?.returnMessages;
    const convId = st?.conversation_id;

    if (convId && Array.isArray(thread) && thread.length > 0) {
      if (appliedConv.current === convId) return;   // already restored
      appliedConv.current = convId;
      const last = thread[thread.length - 1];
      // Render the existing conversation as chat history (each prior message + its
      // analysis). The composer stays empty so the next message threads onto it.
      setTurns(thread.map((it: any) => ({
        key: `h${it.id}`,
        user: { text: it.message_body ?? it.message_title ?? "", channel: it.channel, type: it.content_type },
        result: it as AnalysisResult,
      })));
      setContinuation({ conversationId: convId, parentId: last?.id ?? null });
      // Keep the same brand + context for the next turn (but NOT the old message text).
      if (last?.brand_system_id != null) setBsId(last.brand_system_id);
      if (last?.channel)       setChannel(last.channel);
      if (last?.content_type)  setContentType(last.content_type);
      if (last?.audience)      setAudience(last.audience);
      if (last?.objective)     setObjective(last.objective);
      setResult(null);
      setSentMessage(null);
      setMessageBody("");
      setMessageTitle("");
    } else if (appliedConv.current != null) {
      // Arrived fresh after a continuation: drop the stale thread context.
      appliedConv.current = null;
      setContinuation(null);
      setTurns([]);
      setResult(null);
      setSentMessage(null);
      setMessageBody("");
      setMessageTitle("");
    }
  }, [location.key]);

  // While a message is in flight, keep the streaming indicator in view.
  useEffect(() => {
    if (loading) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading]);

  // When an analysis completes (or a thread is restored), bring the TOP of the
  // newest result into view and move focus to it (keyboard / screen-reader users).
  useEffect(() => {
    if (turns.length === 0) return;
    const el = latestResultRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.focus({ preventScroll: true });
  }, [turns.length]);

  // Auto-grow the composer textarea from a compact default up to a capped height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [messageBody]);

  const reset = () => {
    setResult(null);
    setError("");
    setMessageBody("");
    setMessageTitle("");
    setContextOpen(false);
    setSentMessage(null);
    setTurns([]);               // start a brand-new conversation
    setContinuation(null);      // not threaded onto the old conversation
    appliedConv.current = null;
  };

  const handleSubmit = async () => {
    if (!messageBody.trim() || !bsId || loading) return;

    const apiPayload = {
      brand_system_id:  bsId,
      message_title:    messageTitle || messageBody.slice(0, 60),
      message_body:     messageBody.trim(),
      message_language: "fr",
      channel:          channel || null,
      content_type:     contentType || null,
      audience:         audience || null,
      objective:        objective || null,
      campaign:         campaign || null,
      // Thread onto the existing conversation when continuing an analysis.
      parent_analysis_id: continuation?.parentId ?? null,
      conversation_id:    continuation?.conversationId ?? null,
    };

    const userTurn = { text: messageBody.trim(), channel: channel || undefined, type: contentType || undefined, audience: audience || undefined };
    setSentMessage(userTurn);
    setLoading(true);
    setError("");
    setResult(null);
    setStreamText("");

    // Complete the 2 display fields absent from the API response, from local state.
    const bsName = brandSystems.find(b => b.id === bsId)?.brand_name ?? "";
    const finalize = (data: any) => {
      const result: AnalysisResult = {
        ...data,
        brand_system_name: bsName,
        message_title: messageTitle || userTurn.text.slice(0, 60),
        message_body: userTurn.text,
      };
      // Append this turn to the chat history and clear the composer for the next one.
      setTurns(prev => [...prev, { key: `t${data?.id ?? Date.now()}`, user: userTurn, result }]);
      setSentMessage(null);
      setMessageBody("");
      setMessageTitle("");
      setContextOpen(false);   // collapse context so the result owns the space
      // Chain so the NEXT message threads onto the SAME conversation (chat behaviour),
      // with this analysis as its parent (before/after deltas tracked).
      if (data?.conversation_id) {
        setContinuation({ conversationId: data.conversation_id, parentId: data.id ?? null });
        appliedConv.current = data.conversation_id;
      }
    };

    try {
      // Streaming first: tokens appear live (typewriter), then the final JSON.
      const done = await streamAnalyze(apiPayload, (t) => setStreamText(prev => prev + t));
      finalize(done);
    } catch {
      // Fallback to the classic non-streamed /analyze if the stream fails.
      try {
        const res = await postAnalyze(apiPayload);
        finalize(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Analyse échouée.");
      }
    } finally {
      setLoading(false);
      setStreamText("");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeBs = brandSystems.find(b => b.id === bsId) ?? null;

  // Analysis-access gating: member-level suspension locks every brand; otherwise
  // the lock applies only when the *selected* brand system is suspended.
  const brandBlocked = (id: number | "") =>
    !!access?.brands.find(b => b.id === id && !b.enabled);
  const selBrand = access?.brands.find(b => b.id === bsId);
  const blockedInfo: { scope: "member" | "brand"; message: string } | null =
    access && !access.member_enabled
      ? { scope: "member", message: access.message || "Votre accès à l'analyse a été suspendu par votre administrateur." }
      : selBrand && !selBrand.enabled
        ? { scope: "brand", message: `L'analyse est suspendue pour le Brand System « ${selBrand.brand_name} ».` }
        : null;

  const canSubmit = !!messageBody.trim() && !!bsId && !loading && !blockedInfo;

  const feedEmpty = brandSystems.length > 0 && turns.length === 0 && !sentMessage && !loading;
  const contextChips = ([
    contentType && { k: "Type", v: contentType },
    channel     && { k: "Canal", v: channel },
    audience    && { k: "Audience", v: audience },
    objective   && { k: "Objectif", v: objective },
    campaign    && { k: "Campagne", v: campaign },
  ].filter(Boolean)) as { k: string; v: string }[];

  return (
    <div className="dashboard-root">
      <AppSidebar role="membre" navItems={NAV} />

      <main className="dashboard-main" style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>

        {/* ── Top bar ── */}
        <div className="analyze-topbar" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px", borderBottom: "1px solid var(--bg-border)",
          background: "var(--az-bar)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              boxShadow: "0 0 14px rgba(201,164,73,.3)",
            }}>✦</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Clarity Engine</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Brand Communication Analyser</div>
            </div>
          </div>

          {/* Brand system selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brandSystems.length > 0 && (
              brandSystems.length === 1 ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(201,164,73,.08)", border: "1px solid rgba(201,164,73,.2)",
                  borderRadius: 20, padding: "6px 14px",
                }}>
                  <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>{activeBs?.brand_name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", background: "var(--az-track)", borderRadius: 100, padding: "1px 7px" }}>v{activeBs?.version}</span>
                </div>
              ) : (
                <Select
                  id="bs-select"
                  variant="gold"
                  ariaLabel="Brand system"
                  value={String(bsId)}
                  onChange={v => setBsId(Number(v))}
                  options={brandSystems.map(b => ({
                    value: String(b.id),
                    label: `${brandBlocked(b.id) ? "○ " : ""}${b.brand_name} v${b.version}`,
                  }))}
                />
              )
            )}
            {(turns.length > 0 || sentMessage) && (
              <button
                onClick={reset}
                style={{
                  background: "var(--az-inset)", border: "1px solid var(--az-line)",
                  borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                ↺ Nouvelle conversation
              </button>
            )}
          </div>
        </div>

        {blockedInfo ? (
          <AnalysisLock scope={blockedInfo.scope} message={blockedInfo.message} nav={nav} />
        ) : (
        <>
        {/* ── Chat feed ── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "28px 28px 12px",
          ...(feedEmpty ? { display: "flex", flexDirection: "column", justifyContent: "center" } : null),
        }}>

          {/* No brand system */}
          {brandSystems.length === 0 && (
            <div style={{
              maxWidth: 480, margin: "40px auto", textAlign: "center",
              background: "var(--bg-card)", border: "1px solid var(--bg-border)",
              borderRadius: 16, padding: 32,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>△</div>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                Aucun Brand System assigné à votre compte.<br />Contactez votre administrateur.
              </p>
            </div>
          )}

          {/* Welcome message — only on an empty conversation */}
          {turns.length === 0 && !sentMessage && brandSystems.length > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                boxShadow: "0 0 12px rgba(201,164,73,.3)",
              }}>✦</div>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--bg-border)",
                borderRadius: "4px 16px 16px 16px", padding: "11px 16px",
                maxWidth: "72%", fontSize: 13, color: "var(--text-body)", lineHeight: 1.55,
              }}>
                Collez votre message ci-dessous — je l'évalue instantanément contre <strong style={{ color: "var(--gold)" }}>{activeBs?.brand_name}</strong>.
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Alignment", "Narrative Risk", "Tone", "Focus"].map(tag => (
                    <span key={tag} style={{
                      fontSize: 10, background: "rgba(201,164,73,.1)", color: "var(--gold)",
                      border: "1px solid rgba(201,164,73,.2)", borderRadius: 100, padding: "2px 8px",
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conversation history — each past message + its analysis */}
          {turns.map((t, i) => (
            <div
              key={t.key}
              ref={i === turns.length - 1 ? latestResultRef : undefined}
              tabIndex={-1} role="group" aria-label="Résultat de l'analyse"
              style={{ outline: "none", scrollMarginTop: 16 }}
            >
              <UserBubble text={t.user.text} meta={t.user} />
              <ResultBubble result={t.result} nav={nav} />
            </div>
          ))}

          {/* In-flight turn: the message being analysed right now */}
          {sentMessage && <UserBubble text={sentMessage.text} meta={sentMessage} />}
          {loading && <StreamingThinking chars={streamText.length} brand={activeBs?.brand_name} />}

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "rgba(248,113,113,.15)", border: "1px solid rgba(248,113,113,.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
              }}>✗</div>
              <div style={{
                background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)",
                borderRadius: "4px 18px 18px 18px", padding: "12px 16px",
                fontSize: 13, color: "#f87171", maxWidth: "72%",
              }}>
                {error}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Context panel (collapsible — collapsed by default) ── */}
        {brandSystems.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--bg-border)",
            background: "var(--az-bar)",
            padding: contextOpen ? "12px 28px" : "9px 28px",
          }}>
            {/* Toggle / summary row */}
            <button
              type="button"
              onClick={() => setContextOpen(o => !o)}
              aria-expanded={contextOpen}
              aria-controls="context-fields"
              aria-label={contextOpen
                ? "Réduire le contexte d'évaluation"
                : contextChips.length > 0 ? "Modifier le contexte d'évaluation" : "Ajouter du contexte d'évaluation"}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: "transparent", border: "none", cursor: "pointer",
                padding: 0, textAlign: "left", fontFamily: "inherit",
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0,
                color: contextChips.length > 0 ? "var(--gold)" : "var(--text-dim)",
              }}>
                {contextOpen ? "Contexte d'évaluation" : contextChips.length > 0 ? "Contexte" : "+ Ajouter du contexte"}
              </span>

              {/* Chips summary when collapsed */}
              {!contextOpen && contextChips.map(c => (
                <span key={c.k} style={{
                  background: "rgba(201,164,73,.12)", color: "var(--gold)",
                  border: "1px solid rgba(201,164,73,.2)", borderRadius: 100,
                  padding: "2px 9px", fontSize: 10.5, fontWeight: 600,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160,
                }}>{c.v}</span>
              ))}

              <span style={{ flex: 1, height: 1, background: "var(--az-line-soft)", minWidth: 8 }} />

              {contextOpen && contextChips.length > 0 && (
                <span style={{ background: "rgba(201,164,73,.15)", color: "var(--gold)", borderRadius: 100, padding: "2px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {contextChips.length} sélectionnés
                </span>
              )}
              {!contextOpen && contextChips.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--gold)", flexShrink: 0 }}>Modifier</span>
              )}
              <svg width="11" height="7" viewBox="0 0 10 6" fill="none" aria-hidden="true"
                style={{ flexShrink: 0, transition: "transform .2s", transform: contextOpen ? "rotate(180deg)" : "none" }}>
                <path d="M1 1L5 5L9 1" stroke={contextChips.length > 0 ? "var(--gold)" : "var(--az-faint)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Expanded fields */}
            {contextOpen && (
              <div id="context-fields" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10 }}>
                <ChipSelect id="content-type" label="Type de contenu"      value={contentType} options={CONTENT_TYPES} onChange={setContentType} />
                <ChipSelect id="channel"      label="Canal de diffusion"   value={channel}     options={CHANNELS}      onChange={setChannel} />
                <ChipSelect id="audience"     label="Audience cible"       value={audience}    options={AUDIENCES}     onChange={setAudience} />
                <ChipSelect id="objective"    label="Objectif stratégique" value={objective}   options={OBJECTIVES}    onChange={setObjective} />
                <div>
                  <label htmlFor="campaign" style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Campagne</label>
                  <input
                    id="campaign"
                    type="text"
                    placeholder="ex. Lancement Q4"
                    value={campaign}
                    onChange={e => setCampaign(e.target.value)}
                    style={{
                      width: "100%", background: "var(--az-inset)", border: "1px solid var(--az-line)",
                      borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "var(--text-primary)",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Composer ── */}
        {brandSystems.length > 0 && (
          <div style={{
            padding: "12px 28px 20px",
            background: "var(--az-bar)",
            borderTop: "1px solid var(--bg-border)",
          }}>

            {/* Title field — styled */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--az-inset-soft)",
              border: "1px solid var(--az-line)",
              borderRadius: 10, padding: "7px 14px", marginBottom: 10,
            }}>
              <span style={{ fontSize: 13, color: "var(--text-dim)", flexShrink: 0 }}>✎</span>
              <input
                type="text"
                placeholder="Titre du message (optionnel)"
                value={messageTitle}
                onChange={e => setMessageTitle(e.target.value)}
                style={{
                  flex: 1, background: "transparent", border: "none",
                  outline: "none", fontSize: 12.5, color: "var(--text-primary)",
                  fontFamily: "inherit", fontWeight: 500,
                }}
              />
              {messageTitle && (
                <button
                  onClick={() => setMessageTitle("")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-dim)", fontSize: 14, padding: 0, lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>

            {/* Main composer box */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              background: "var(--bg-card)", border: "1px solid var(--bg-border)",
              borderRadius: 16, padding: "12px 14px",
            }}>
              <textarea
                ref={textareaRef}
                id="message-body"
                placeholder="Collez votre message ici — post, email, discours, campagne…"
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: 13.5, color: "var(--text-primary)",
                  lineHeight: 1.65, fontFamily: "inherit",
                  minHeight: 46, maxHeight: 160, overflowY: "auto",
                }}
              />
              {/* Send button */}
              <button
                id="submit-analysis-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                title="Lancer l'analyse (⌘ + Entrée)"
                style={{
                  width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
                  background: canSubmit
                    ? "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)"
                    : "var(--az-track)",
                  color: canSubmit ? "#0B1220" : "var(--text-dim)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: canSubmit ? "0 0 16px rgba(201,164,73,.35)" : "none",
                  transition: "all .2s",
                  alignSelf: "flex-end",
                }}
              >
                {loading ? (
                  <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "#0B1220" }} />
                ) : "↑"}
              </button>
            </div>

            {/* Footer hint */}
            <div style={{ marginTop: 8, padding: "0 4px" }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>⌘ + Entrée pour analyser</span>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }
        .chat-result-bubble {
          background: var(--bg-card);
          border: 1px solid var(--bg-border);
          border-radius: 4px 18px 18px 18px;
          padding: 22px 22px;
          margin-bottom: 8px;
          max-width: 92%;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--az-line); border-radius: 4px; }
        .dashboard-main::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
