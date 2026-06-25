import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getConversation } from "../services/brandSystems";
import type { ConversationAnalysis, PointItem, RecoItem } from "../services/brandSystems";

const _txt  = (p: string | PointItem): string => typeof p === "string" ? p : p.text;
const _ev   = (p: string | PointItem): string => typeof p === "string" ? "" : (p.evidence ?? "");
const _be   = (r: string | RecoItem):  string => typeof r === "string" ? "" : (r.brand_element ?? "");
import { isAdmin, isBrandAdmin } from "../services/auth";
import AppSidebar from "../components/AppSidebar";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";

/** Download the professional server-generated PDF for a single analysis (message). */
async function downloadPdf(analysisId: number, title: string) {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/analyses/${analysisId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("PDF generation failed");
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `clarity-rapport-${analysisId}-${title.slice(0, 40).replace(/[^a-z0-9]/gi, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert("Erreur lors de la génération du PDF. Veuillez réessayer.");
  }
}

const NAV_MEMBRE = [
  { path: "/",        label: "Tableau de bord", icon: "⬡" },
  { path: "/analyze", label: "Analyser",          icon: "✦" },
  { path: "/history", label: "Historique",        icon: "◷" },
];
const NAV_BRAND = [
  { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
  { path: "/brand/users",     label: "Équipe",           icon: "◎" },
  { path: "/history",         label: "Historique",       icon: "◷" },
];
const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",     icon: "◈" },
  { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
  { path: "/history",         label: "Historique",  icon: "◷" },
];

const scoreColor = (s: number) =>
  s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";
const scoreClass = (s: number) =>
  s >= 75 ? "good" : s >= 50 ? "warn" : "bad";
// Risk lookup — supports v1.0 French values and legacy English values
const _riskKey = (r: string) => r?.toLowerCase().replace(/\u00e9/g, "e") ?? "";
const riskClass = (r: string) => {
  const k = _riskKey(r);
  return k === "faible" || k === "low" ? "risk-low"
       : k === "modere" || k === "medium" ? "risk-medium"
       : "risk-high";
};
const riskLbl = (r: string) => {
  const k = _riskKey(r);
  return k === "faible" || k === "low" ? "Faible"
       : k === "modere" || k === "medium" ? "Mod\u00e9r\u00e9"
       : k === "eleve"  || k === "high"  ? "\u00c9lev\u00e9"
       : r;
};

const SUB_KEYS = [
  "sub_lisibilite", "sub_alignment", "sub_focus",
  "sub_tone", "sub_narrative_contribution",
] as const;
const SUB_LABELS = ["Lisibilité", "Alignement", "Focus", "Ton", "Narrative"];

/* ── Skeleton card ────────────────────────────────────────────── */
function SkeletonCard({ index }: { index: number }) {
  return (
    <div style={{ display: "flex", gap: 0, opacity: 0, animation: `fadeUp 0.35s ease ${index * 0.07}s forwards` }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg3)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
        {index < 2 && <div style={{ flex: 1, width: 2, background: "var(--border)", minHeight: 48, marginTop: 4 }} />}
      </div>
      <div className="result-card" style={{ flex: 1, marginLeft: 12, marginBottom: 16, padding: "16px 18px", animation: "skeletonPulse 1.4s ease-in-out infinite" }}>
        <div style={{ height: 13, width: "55%", borderRadius: 6, background: "var(--bg3)", marginBottom: 10 }} />
        <div style={{ height: 10, width: "30%", borderRadius: 6, background: "var(--bg3)" }} />
      </div>
    </div>
  );
}

/* ── Score delta badge ────────────────────────────────────────── */
function DeltaBadge({ prev, curr }: { prev: number; curr: number }) {
  const d = curr - prev;
  if (d === 0) return <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 6 }}>= 0</span>;
  const col = d > 0 ? "#2e7d5e" : "#c0392b";
  const bg  = d > 0 ? "rgba(46,125,94,0.1)" : "rgba(192,57,43,0.1)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 700, color: col,
      background: bg, border: `1px solid ${col}33`,
      borderRadius: 100, padding: "1px 8px", marginLeft: 6,
    }}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)} pts
    </span>
  );
}

/* ── Single analysis card ────────────────────────────────────── */
function AnalysisCard({
  item, index, total, prevScore, visible,
}: {
  item: ConversationAnalysis;
  index: number;
  total: number;
  prevScore: number | null;
  visible: boolean;
}) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;
  const isOnly  = total === 1;
  const [expanded, setExpanded] = useState(isFirst || isLast);
  const col = scoreColor(item.clarity_score);
  const r = 34; const circ = 2 * Math.PI * r;
  const offset = circ - (item.clarity_score / 100) * circ;

  const label = isFirst
    ? "Message original"
    : `Amélioration ${index}`;

  const preview = item.message_body
    ? item.message_body.slice(0, 120) + (item.message_body.length > 120 ? "…" : "")
    : null;

  return (
    <div
      style={{
        display: "flex", gap: 0,
        opacity: 0,
        animation: visible ? `fadeUp 0.38s ease ${index * 0.09}s forwards` : "none",
      }}
    >
      {/* Timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", zIndex: 1, flexShrink: 0,
          background: isLast && !isOnly ? col : "var(--bg2)",
          border: `2.5px solid ${col}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isLast && !isOnly ? `0 0 0 4px ${col}22` : "none",
          transition: "box-shadow 0.3s ease",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: isLast && !isOnly ? "#fff" : col }}>
            {index + 1}
          </span>
        </div>
        {!isLast && (
          <div style={{ flex: 1, width: 2, background: "var(--border)", minHeight: 20, marginTop: 4 }} />
        )}
      </div>

      {/* Card body */}
      <div
        className="result-card"
        style={{
          flex: 1, marginLeft: 12, marginBottom: 16, padding: 0, overflow: "hidden",
          borderRadius: "var(--radius)",
          transition: "box-shadow 0.18s ease",
        }}
      >
        {/* Card header — clickable to expand/collapse */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer",
            background: isLast && !isOnly
              ? `linear-gradient(135deg, ${col}14 0%, var(--bg2) 100%)`
              : "var(--bg2)",
            borderBottom: expanded ? "1px solid var(--border)" : "none",
            borderRadius: expanded ? "var(--radius) var(--radius) 0 0" : "var(--radius)",
            transition: "background 0.2s ease",
          }}
        >
          {/* Score ring */}
          <div style={{ position: "relative", width: 76, height: 76, flexShrink: 0 }}>
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r={r} fill="none" stroke="var(--bg3)" strokeWidth="6" />
              <circle cx="38" cy="38" r={r} fill="none" stroke={col} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 38 38)"
                style={{ transition: "stroke-dashoffset 0.9s ease 0.2s" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: col, lineHeight: 1 }}>{item.clarity_score}</span>
              <span style={{ fontSize: 9, color: "var(--text-dim)" }}>/100</span>
            </div>
          </div>

          {/* Label + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                {label}
              </span>
              {isLast && !isFirst && !isOnly && (
                <span style={{
                  fontSize: 10, background: col, color: "#fff",
                  padding: "1px 7px", borderRadius: 100, fontWeight: 700,
                  letterSpacing: "0.3px",
                }}>
                  Meilleur
                </span>
              )}
              {prevScore !== null && <DeltaBadge prev={prevScore} curr={item.clarity_score} />}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {item.analyzed_at?.slice(0, 10)}
              </span>
              {item.analyzed_by && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, borderRadius: "50%",
                    background: `hsl(${(item.analyzed_by.charCodeAt(0) * 37) % 360}, 60%, 42%)`,
                    color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>
                    {item.analyzed_by.slice(0, 1).toUpperCase()}
                  </span>
                  <span style={{ color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.analyzed_by}
                  </span>
                </span>
              )}
              {item.channel && (
                <span style={{
                  fontSize: 11, background: "var(--bg3)", padding: "1px 7px",
                  borderRadius: "var(--radius-xs)", color: "var(--text-muted)",
                }}>
                  {item.channel}
                </span>
              )}
              {item.narrative_risk && (
                <span className={`risk-badge ${riskClass(item.narrative_risk)}`}
                  style={{ fontSize: 10, padding: "2px 8px" }}>
                  {riskLbl(item.narrative_risk)}
                </span>
              )}
            </div>

            {/* Message preview (collapsed) */}
            {!expanded && preview && (
              <p style={{
                marginTop: 7, fontSize: 12, color: "var(--text-dim)",
                lineHeight: 1.55, fontStyle: "italic",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                "{preview}"
              </p>
            )}
          </div>

          {/* Export this message as a professional PDF (available to every role) */}
          <button
            onClick={(e) => { e.stopPropagation(); downloadPdf(item.id, item.message_title); }}
            title="Exporter ce message en PDF"
            style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "6px 11px",
              borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)",
              color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Exporter PDF
          </button>

          {/* Chevron */}
          <span style={{
            color: "var(--text-dim)", fontSize: 18, flexShrink: 0,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            display: "inline-block",
          }}>
            ›
          </span>
        </div>

        {/* Expanded body */}
        {expanded && (
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Message preview full */}
            {item.message_body && (
              <div>
                <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: "0.5px", marginBottom: 7 }}>
                  Message
                </p>
                <p style={{
                  fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)",
                  background: "var(--bg3)", borderRadius: "var(--radius-xs)",
                  padding: "10px 14px", maxHeight: 160, overflow: "auto",
                  borderLeft: `3px solid ${col}`,
                }}>
                  {item.message_body}
                </p>
              </div>
            )}

            {/* Subscores grid */}
            <div>
              <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: "0.5px", marginBottom: 10 }}>
                Sous-scores /20
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {SUB_KEYS.map((key, i) => {
                  const val = (item as unknown as Record<string, unknown>)[key] as number | undefined;
                  if (val === undefined) return null;
                  return (
                    <div key={key} style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 5, letterSpacing: "0.4px" }}>
                        {SUB_LABELS[i]}
                      </p>
                      <p className={`score-val ${scoreClass(val * 5)}`} style={{ fontSize: 15 }}>
                        {val}<span style={{ fontSize: "0.55em", color: "var(--text-dim)", fontWeight: 400 }}>/20</span>
                      </p>
                      <div className="score-bar-mini" style={{ marginTop: 6 }}>
                        <div className="score-bar-fill" style={{ width: `${(val / 20) * 100}%`, background: scoreColor(val * 5) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Points sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {item.points_forts?.length > 0 && (
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6, letterSpacing: "0.5px" }}>Points Forts</p>
                  {item.points_forts.map((p, i) => (
                    <div key={i} style={{ background: "rgba(46,125,94,0.06)", borderLeft: "2.5px solid #2e7d5e", padding: "7px 12px", borderRadius: "var(--radius-xs)", marginBottom: 5 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text-muted)" }}>{_txt(p)}</div>
                      {_ev(p) && <div style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)", fontStyle: "italic", marginTop: 4 }}>« {_ev(p)} »</div>}
                    </div>
                  ))}
                </div>
              )}
              {item.points_faibles?.length > 0 && (
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6, letterSpacing: "0.5px" }}>Points Faibles</p>
                  {item.points_faibles.map((p, i) => (
                    <div key={i} style={{ background: "rgba(176,125,40,0.06)", borderLeft: "2.5px solid #b07d28", padding: "7px 12px", borderRadius: "var(--radius-xs)", marginBottom: 5 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text-muted)" }}>{_txt(p)}</div>
                      {_ev(p) && <div style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)", fontStyle: "italic", marginTop: 4 }}>« {_ev(p)} »</div>}
                    </div>
                  ))}
                </div>
              )}
              {item.recommandations?.length > 0 && (
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6, letterSpacing: "0.5px" }}>Recommandations</p>
                  {item.recommandations.map((r, i) => (
                    <div key={i} style={{ background: "var(--accent-dim)", borderLeft: "2.5px solid var(--accent)", padding: "7px 12px", borderRadius: "var(--radius-xs)", marginBottom: 5 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--text-muted)" }}>{_txt(r)}</div>
                      {_be(r) && <span style={{ display: "inline-block", marginTop: 5, fontSize: 10, fontWeight: 700, padding: "1px 8px", background: "rgba(201,164,73,0.15)", color: "var(--accent)", border: "1px solid rgba(201,164,73,0.3)", borderRadius: 100 }}>⊞ {_be(r)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function ConversationThread() {
  const { conversation_id } = useParams<{ conversation_id: string }>();
  const nav = useNavigate();
  const [items, setItems]       = useState<ConversationAnalysis[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [visible, setVisible]   = useState(false);
  const mountRef = useRef(false);

  useEffect(() => {
    if (!conversation_id) return;
    setLoading(true);
    setVisible(false);
    getConversation(conversation_id)
      .then(data => {
        setItems(data);
        // Stagger fade-in after data arrives
        requestAnimationFrame(() => setTimeout(() => setVisible(true), 40));
      })
      .catch(() => setError("Conversation introuvable"))
      .finally(() => setLoading(false));
    mountRef.current = true;
  }, [conversation_id]);

  const firstTitle  = items[0]?.message_title  ?? "Conversation";
  const brandName   = items[0]?.brand_system_name ?? "";
  const bestScore   = items.length ? Math.max(...items.map(i => i.clarity_score)) : 0;
  const initScore   = items[0]?.clarity_score  ?? 0;
  const scoreDelta  = items.length > 1 ? bestScore - initScore : null;

  const admin = isAdmin();
  const brandAdmin = isBrandAdmin();
  const NAV = admin ? NAV_ADMIN : brandAdmin ? NAV_BRAND : NAV_MEMBRE;
  const role = admin ? "admin" as const : brandAdmin ? "brand_admin" as const : "membre" as const;

  return (
    <div className="dashboard-root">
      <AppSidebar role={role} navItems={NAV} />

      {/* Main */}
      <main className="dashboard-main">
        <div className="page-content">

          {/* Back button — always visible */}
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "5px 12px", marginBottom: 20 }}
            onClick={() => nav("/history")}
          >
            ← Retour aux conversations
          </button>

          {loading ? (
            <>
              {/* Skeleton header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ height: 22, width: "50%", borderRadius: 8, background: "var(--bg3)", marginBottom: 12, animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  {[90, 70, 100].map((w, i) => (
                    <div key={i} style={{ height: 20, width: w, borderRadius: 100, background: "var(--bg3)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
                  ))}
                </div>
              </div>
              {/* Skeleton stat bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 28 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="result-card" style={{ padding: "14px 16px", animation: "skeletonPulse 1.4s ease-in-out infinite" }}>
                    <div style={{ height: 10, width: "60%", borderRadius: 6, background: "var(--bg3)", margin: "0 auto 10px" }} />
                    <div style={{ height: 20, width: "40%", borderRadius: 6, background: "var(--bg3)", margin: "0 auto" }} />
                  </div>
                ))}
              </div>
              {/* Skeleton cards */}
              {[0, 1, 2].map(i => <SkeletonCard key={i} index={i} />)}
            </>
          ) : error ? (
            <div className="empty-cta">
              <span style={{ fontSize: "2rem" }}>△</span>
              <p>{error}</p>
              <button className="btn-primary" onClick={() => nav("/history")}>← Retour</button>
            </div>
          ) : (
            <>
              {/* Page header */}
              <div style={{ marginBottom: 24, opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}>
                <h1 className="dash-title" style={{ marginBottom: 8 }}>{firstTitle}</h1>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, background: "var(--bg3)", padding: "3px 10px", borderRadius: "var(--radius-xs)", color: "var(--text-muted)" }}>
                    {brandName}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {items.length} itération{items.length > 1 ? "s" : ""}
                  </span>
                  {scoreDelta !== null && (
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: scoreDelta > 0 ? "#2e7d5e" : scoreDelta < 0 ? "#c0392b" : "var(--text-dim)",
                      background: scoreDelta > 0 ? "rgba(46,125,94,0.1)" : "rgba(192,57,43,0.1)",
                      padding: "3px 10px", borderRadius: 100,
                      border: `1px solid ${scoreDelta > 0 ? "rgba(46,125,94,0.2)" : "rgba(192,57,43,0.2)"}`,
                    }}>
                      {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta)} pts de progression
                    </span>
                  )}
                </div>
              </div>

              {/* Summary stats (multi-analysis thread only) */}
              {items.length > 1 && (
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
                  marginBottom: 28,
                  opacity: visible ? 1 : 0, transition: "opacity 0.45s ease 0.1s",
                }}>
                  {[
                    { label: "Score initial",  value: `${initScore}/100`,  color: scoreColor(initScore) },
                    { label: "Meilleur score", value: `${bestScore}/100`,  color: scoreColor(bestScore) },
                    { label: "Progression",    value: scoreDelta !== null ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta} pts` : "—", color: scoreDelta !== null && scoreDelta > 0 ? "#2e7d5e" : "#c0392b" },
                  ].map(s => (
                    <div key={s.label} className="result-card" style={{ padding: "16px 18px", textAlign: "center", borderRadius: "var(--radius)" }}>
                      <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", letterSpacing: "0.6px", marginBottom: 8 }}>{s.label}</p>
                      <p style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Lora', serif", lineHeight: 1 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              <div>
                {items.map((item, i) => (
                  <AnalysisCard
                    key={item.id}
                    item={item}
                    index={i}
                    total={items.length}
                    prevScore={i > 0 ? items[i - 1].clarity_score : null}
                    visible={visible}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="result-footer" style={{
                marginTop: 8,
                opacity: visible ? 1 : 0, transition: "opacity 0.5s ease 0.3s",
              }}>
                <button className="btn-ghost" onClick={() => nav("/history")}>← Retour</button>
                <div style={{ display: "flex", gap: 10 }}>
                  {!admin && !brandAdmin && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        nav("/analyze", {
                          state: {
                            conversation_id: conversation_id ?? "",
                            history: items,   // full thread → restored in Analyze.tsx
                          },
                        });
                      }}
                    >
                      ✦ Continuer l'analyse
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Keyframes + print styles */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @media print {
          @page { margin: 16mm 14mm; size: A4 portrait; }
          body * { visibility: hidden !important; }
          .page-content, .page-content * { visibility: visible !important; }
          .page-content {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 20px 32px !important;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif !important;
            overflow: visible !important;
          }
          .page-content * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          /* hide buttons in print */
          .page-content .result-footer,
          .page-content .btn-ghost,
          .page-content .btn-primary { display: none !important; }
          /* white card backgrounds */
          .page-content .result-card {
            background: #f9fafb !important;
            border: 1.5px solid #d1d5db !important;
          }
          /* score ring track */
          .page-content circle { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          /* subscore bars */
          .page-content .score-bar-mini .score-bar-fill { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          /* points sections */
          .page-content [data-thread="good"] { background: #dcfce7 !important; border-left-color: #16a34a !important; color: #14532d !important; }
          .page-content [data-thread="warn"] { background: #fef9c3 !important; border-left-color: #ca8a04 !important; color: #713f12 !important; }
          .page-content [data-thread="info"] { background: #dbeafe !important; border-left-color: #2563eb !important; color: #1e3a5f !important; }
          /* avoid mid-card page breaks */
          .page-content > div { page-break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}
