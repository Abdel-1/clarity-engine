import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getAnalysis } from "../services/brandSystems";
import { isAdmin, isBrandAdmin } from "../services/auth";
import AppSidebar from "../components/AppSidebar";

interface PointItem { text: string; evidence?: string }
interface RecoItem  { text: string; brand_element?: string }

// Backward-compat normalizers for analyses stored before v2 schema
const toPoint = (p: string | PointItem): PointItem =>
  typeof p === "string" ? { text: p, evidence: "" } : p;
const toReco  = (r: string | RecoItem):  RecoItem  =>
  typeof r === "string" ? { text: r, brand_element: "" } : r;

interface AnalysisData {
  id: number; message_title: string; brand_system_name: string;
  message_language: string; channel: string; content_type: string;
  clarity_score: number; sub_lisibilite: number; sub_alignment: number;
  sub_focus: number; sub_tone: number; sub_narrative_contribution: number;
  reasoning?: Record<string, string>;
  points_forts: (string | PointItem)[];
  points_faibles: (string | PointItem)[];
  recommandations: (string | RecoItem)[];
  analyzed_at: string; parent_analysis_id: number | null;
  conversation_id?: string | null;
  message_body?: string;
  narrative_risk?: string;
  analyzed_by?: string;
  brand_mismatch?: boolean;
  brand_mismatch_note?: string;
}

const scoreHex = (n: number, max: number): string => {
  const p = n / max;
  return p >= 0.75 ? "#16a34a" : p >= 0.5 ? "#d97706" : "#dc2626";
};

const scoreLabel = (n: number, max: number): string => {
  const p = n / max;
  return p >= 0.75 ? "Excellent" : p >= 0.5 ? "Satisfaisant" : "À améliorer";
};

const riskColor = (r?: string) => {
  const v = (r ?? "").toLowerCase().replace(/\u00e9/g, "e");
  return v === "faible" || v === "low" ? "#16a34a"
       : v === "modere" || v === "medium" ? "#d97706"
       : "#dc2626";
};
const riskLabel = (r?: string) => {
  const v = (r ?? "").toLowerCase().replace(/\u00e9/g, "e");
  return v === "faible" || v === "low" ? "Faible"
       : v === "modere" || v === "medium" ? "Mod\u00e9r\u00e9"
       : v === "eleve" || v === "high" ? "\u00c9lev\u00e9"
       : r || "\u2014";
};

const SUBS = [
  { key: "sub_lisibilite",                rk: "clarity",                label: "Lisibilité",   icon: "◎", desc: "Clarté et fluidité du texte" },
  { key: "sub_alignment",                 rk: "alignment",              label: "Alignement",   icon: "⊞", desc: "Cohérence avec l'identité de marque" },
  { key: "sub_focus",                     rk: "focus",                  label: "Focus",        icon: "◈", desc: "Précision et concentration du message" },
  { key: "sub_tone",                      rk: "tone",                   label: "Ton",          icon: "♪", desc: "Adéquation tonale et registre" },
  { key: "sub_narrative_contribution",    rk: "narrative_contribution",  label: "Narratif",     icon: "✦", desc: "Force de la contribution narrative" },
];

const NAV_MEMBRE = [
  { path: "/",        label: "Tableau de bord", icon: "⬡" },
  { path: "/analyze", label: "Analyser",         icon: "✦" },
  { path: "/history", label: "Historique",       icon: "◷" },
];
const NAV_BRAND = [
  { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
  { path: "/brand/users",     label: "Équipe",          icon: "◎" },
  { path: "/history",         label: "Historique",      icon: "◷" },
];
const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",     icon: "◈" },
  { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
  { path: "/history",         label: "Historique",  icon: "◷" },
];

/* ── Print CSS ───────────────────────────────────────────────────────────
   Exports the report as a PDF that matches the on-screen DARK style. We print
   only #rapport-print-zone, keep every colour/background (print-color-adjust),
   and let the report flow naturally so multi-page reports paginate cleanly. */
const PRINT_CSS = `
  @media print {
    @page { size: A4 portrait; margin: 0; }

    /* Paint the whole sheet dark, like the on-screen report. The colour also
       overrides the global print rule (body{color:#000}) so inherited text
       stays light; per-element inline colours are untouched (no '*' override). */
    html, body { background: #0B1220 !important; color: #CBD5E1 !important; }

    /* Hide all app chrome — only the report zone prints */
    .dashboard-root > *:not(.dashboard-main) { display: none !important; }
    .no-print { display: none !important; }

    .dashboard-root { display: block !important; height: auto !important; overflow: visible !important; }
    .dashboard-main {
      height: auto !important; overflow: visible !important;
      padding: 0 !important; background: #0B1220 !important;
    }

    /* Force-keep every dark background / colour the print engine would strip */
    #rapport-print-zone, #rapport-print-zone * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #rapport-print-zone {
      max-width: 100% !important; margin: 0 !important;
      padding: 12mm 10mm !important; background: #0B1220 !important;
    }

    /* Don't slice a section across two pages */
    #rapport-print-zone > div { break-inside: avoid; page-break-inside: avoid; }
  }
`;

/* ── Animated counter ─────────────────────────────────────────────── */
function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{val}</>;
}

export default function AnalysisResult() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const location = useLocation();
  const routeState = location.state as {
    conversation_id?: string;
    returnMessages?: unknown[];
  } | null;

  const [data, setData]       = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!id) return;
    getAnalysis(id)
      .then(setData)
      .catch(() => setError("Analyse non trouvée"))
      .finally(() => setLoading(false));
  }, [id]);

  const admin      = isAdmin();
  const brandAdmin = isBrandAdmin();
  const NAV  = admin ? NAV_ADMIN : brandAdmin ? NAV_BRAND : NAV_MEMBRE;
  const role = admin ? "admin" as const : brandAdmin ? "brand_admin" as const : "membre" as const;

  if (loading) return (
    <div className="page-loading"><span className="spinner spinner-lg" /> Chargement…</div>
  );
  if (!data) return (
    <div style={{ padding: 40 }}>
      <div className="empty-cta">
        <p>{error}</p>
        <button onClick={() => nav("/analyze")} className="btn-primary">Nouvelle Analyse →</button>
      </div>
    </div>
  );

  const score     = data.clarity_score;
  const r         = 72;
  const circ      = 2 * Math.PI * r;
  const offset    = circ - (score / 100) * circ;
  const ringColor = scoreHex(score, 100);

  const convId         = data.conversation_id || routeState?.conversation_id;
  const returnMessages = routeState?.returnMessages;

  const handleReturn = () => {
    if (admin || brandAdmin) {
      nav(convId ? `/history/${convId}` : "/history");
    } else {
      if (convId) {
        nav("/analyze", {
          state: { conversation_id: convId, ...(returnMessages ? { returnMessages } : {}) },
        });
      } else {
        nav("/history");
      }
    }
  };

  // Export the report as a PDF matching the on-screen dark style, via the
  // browser's native print pipeline (vector text, multi-page, faithful colours).
  // The print stylesheet (PRINT_CSS) isolates #rapport-print-zone and keeps the
  // dark theme; the user just picks "Save as PDF" as the destination.
  const exportPdf = () => {
    const prev = document.title;
    const safe = (data.message_title || "rapport").slice(0, 40).replace(/[^a-z0-9]/gi, "_");
    document.title = `Clarity-Rapport-${data.id}-${safe}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const totalPoints = (data.points_forts?.length || 0) + (data.points_faibles?.length || 0) + (data.recommandations?.length || 0);

  return (
    <div className="dashboard-root">
      <style>{PRINT_CSS}</style>
      <AppSidebar role={role} navItems={NAV} />

      <main className="dashboard-main" style={{ padding: 0, overflow: "auto", background: "var(--bg1)" }}>

        {/* ── Sticky topbar ── */}
        <div className="no-print result-topbar" style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "rgba(15,15,20,0.92)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
          padding: "11px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={handleReturn}>
              ← {convId ? "Retour à la conversation" : "Retour à l'historique"}
            </button>
            <div style={{ width: 1, height: 16, background: "var(--border)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {data.message_title}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 9px",
              background: `${ringColor}22`, color: ringColor,
              borderRadius: 100, border: `1px solid ${ringColor}55`
            }}>
              {scoreLabel(score, 100)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {data.brand_system_name} · {data.analyzed_at?.slice(0, 10)}
            </span>
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} onClick={exportPdf}
              title="Ouvre l'aperçu d'impression — choisissez « Enregistrer au format PDF »">
              Exporter PDF
            </button>
            {!admin && !brandAdmin && (
              <button className="btn-primary" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => nav("/analyze")}>
                + NOUVELLE ANALYSE
              </button>
            )}
          </div>
        </div>

        {/* ── Print zone ── */}
        <div id="rapport-print-zone" style={{ padding: "32px 36px", maxWidth: 1200, margin: "0 auto", boxSizing: "border-box" }}>

          {/* Print header */}
          <div className="rapport-print-header" style={{ display: "none", marginBottom: 24 }}>
            <div><h1>{data.message_title}</h1><p>{data.brand_system_name} · {data.analyzed_at?.slice(0, 10)}</p></div>
            <div style={{ textAlign: "right" }}><p>Rapport d'Analyse de Communication</p><p>Clarity Engine</p></div>
          </div>

          {/* Brand-ownership notice — message belongs to a different brand (non-scoring) */}
          {data.brand_mismatch && data.brand_mismatch_note && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.30)",
              borderRadius: 12, padding: "14px 18px",
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#dc2626", lineHeight: 1.5 }}>
                {data.brand_mismatch_note}
              </span>
            </div>
          )}

          {/* ════════════════════════════════ HERO SECTION ════════════════════════════ */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20,
          }}>
            {/* Left — Score hero */}
            <div style={{
              background: "linear-gradient(135deg, var(--bg2) 0%, rgba(201,164,73,0.07) 100%)",
              border: "1px solid var(--border)", borderRadius: 16,
              padding: "32px 36px", position: "relative", overflow: "hidden",
            }}>
              {/* Glow bg */}
              <div style={{
                position: "absolute", top: -40, right: -40,
                width: 200, height: 200, borderRadius: "50%",
                background: `radial-gradient(circle, ${ringColor}18 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />

              <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-dim)", marginBottom: 24 }}>
                Score Global de Clarté
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                {/* Ring */}
                <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                  <svg width="160" height="160" viewBox="0 0 176 176">
                    <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
                    <circle cx="88" cy="88" r={r} fill="none" stroke={ringColor} strokeWidth="13"
                      strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                      transform="rotate(-90 88 88)"
                      style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)", filter: `drop-shadow(0 0 8px ${ringColor}88)` }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: ringColor, fontFamily: "'Lora',serif", fontSize: "2.6rem", fontWeight: 700, lineHeight: 1 }}>
                      <AnimatedNumber target={score} />
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginTop: 2 }}>/100</span>
                  </div>
                </div>

                {/* Right of ring */}
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{
                      fontSize: "1.6rem", fontWeight: 700,
                      color: ringColor, fontFamily: "'Lora',serif",
                    }}>
                      {scoreLabel(score, 100)}
                    </span>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                      Évaluation stratégique du message
                    </p>
                  </div>

                  {/* Bar */}
                  <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{
                      height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${ringColor}88, ${ringColor})`,
                      borderRadius: 4, transition: "width 1.2s ease",
                      boxShadow: `0 0 12px ${ringColor}66`,
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>0</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ringColor }}>{score}/100</span>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>100</span>
                  </div>

                  {/* Risk badge */}
                  <div style={{ marginTop: 16 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "4px 12px",
                      background: `${riskColor(data.narrative_risk)}22`,
                      color: riskColor(data.narrative_risk),
                      border: `1px solid ${riskColor(data.narrative_risk)}55`,
                      borderRadius: 100,
                    }}>
                      Risque Narratif : {riskLabel(data.narrative_risk)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Context meta */}
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16,
              padding: "32px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-dim)", marginBottom: 20 }}>
                Contexte de l'Analyse
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1 }}>
                {[
                  { icon: "⬡", label: "Système de Marque", val: data.brand_system_name },
                  { icon: "◈", label: "Canal", val: data.channel || "Non spécifié" },
                  { icon: "▤", label: "Type de Contenu", val: data.content_type || "Non spécifié" },
                  { icon: "◇", label: "Langue", val: data.message_language?.toUpperCase() || "—" },
                  { icon: "◷", label: "Date d'Analyse", val: data.analyzed_at?.slice(0, 10) || "—" },
                  { icon: "◆", label: "Analysé par", val: data.analyzed_by || "—" },
                ].map(item => (
                  <div key={item.label} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <p style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                      {item.icon} {item.label}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{item.val}</p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <div style={{
                  flex: 1, textAlign: "center", padding: "10px 8px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10,
                }}>
                  <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", fontFamily: "'Lora',serif" }}>{totalPoints}</p>
                  <p style={{ fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>Points Total</p>
                </div>
                <div style={{
                  flex: 1, textAlign: "center", padding: "10px 8px",
                  background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: 10,
                }}>
                  <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "#16a34a", fontFamily: "'Lora',serif" }}>{data.points_forts?.length || 0}</p>
                  <p style={{ fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>Points Forts</p>
                </div>
                <div style={{
                  flex: 1, textAlign: "center", padding: "10px 8px",
                  background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 10,
                }}>
                  <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "#d97706", fontFamily: "'Lora',serif" }}>{data.points_faibles?.length || 0}</p>
                  <p style={{ fontSize: 9.5, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>À Améliorer</p>
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════ SUBSCORES SECTION ═══════════════════════════ */}
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16,
            padding: "28px 32px", marginBottom: 20,
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-dim)", marginBottom: 20 }}>
              Analyse des 5 Dimensions Stratégiques
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
              {SUBS.map((s) => {
                const val = data[s.key as keyof AnalysisData] as number;
                const col = scoreHex(val, 20);
                const pct = (val / 20) * 100;
                return (
                  <div key={s.key} style={{
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${col}33`,
                    borderRadius: 12, padding: "20px 16px", textAlign: "center",
                    position: "relative", overflow: "hidden",
                    transition: "transform 0.2s",
                  }}>
                    {/* Background glow */}
                    <div style={{
                      position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)",
                      width: 80, height: 80, borderRadius: "50%",
                      background: `radial-gradient(circle, ${col}20 0%, transparent 70%)`,
                      pointerEvents: "none",
                    }} />

                    <span style={{ fontSize: 20, marginBottom: 8, display: "block" }}>{s.icon}</span>
                    <p style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-dim)", marginBottom: 12 }}>
                      {s.label}
                    </p>

                    {/* Circular mini ring */}
                    <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 10px" }}>
                      <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle cx="32" cy="32" r="26" fill="none" stroke={col} strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 26}
                          strokeDashoffset={2 * Math.PI * 26 - (pct / 100) * 2 * Math.PI * 26}
                          strokeLinecap="round" transform="rotate(-90 32 32)"
                          style={{ transition: "stroke-dashoffset 1.2s ease", filter: `drop-shadow(0 0 4px ${col}88)` }} />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: col, fontFamily: "'Lora',serif" }}>{val}</span>
                      </div>
                    </div>

                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>/20</span>
                    <p style={{ fontSize: 9.5, color: col, fontWeight: 700, marginTop: 6 }}>{scoreLabel(val, 20)}</p>
                    <p style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.4 }}>{s.desc}</p>
                    {data.reasoning?.[s.rk] && (
                      <p style={{
                        fontSize: 9.5, color: "var(--text-dim)", marginTop: 10,
                        lineHeight: 1.55, textAlign: "left", fontStyle: "italic",
                        borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8,
                      }}>
                        {data.reasoning[s.rk]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ════════════════════════════ MESSAGE BODY ══════════════════════════════════════════ */}
          {data.message_body && (
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16,
              padding: "28px 32px", marginBottom: 20,
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--text-dim)", marginBottom: 16 }}>
                Message Analysé
              </p>
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                borderLeft: "4px solid var(--accent)", borderRadius: 10,
                padding: "18px 20px", fontSize: 14, lineHeight: 1.8,
                color: "var(--text)", whiteSpace: "pre-wrap",
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}>
                {data.message_body}
              </div>
            </div>
          )}

          {/* ════════════════════════════ POINTS SECTION ══════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: data.recommandations?.length > 0 ? "1fr 1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* Points Forts */}
            {data.points_forts?.length > 0 && (
              <div style={{
                background: "var(--bg2)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 16,
                overflow: "hidden",
              }}>
                <div style={{
                  background: "rgba(22,163,74,0.10)", borderBottom: "1px solid rgba(22,163,74,0.20)",
                  padding: "16px 24px", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      Points Forts
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(22,163,74,0.7)" }}>
                      {data.points_forts.length} élément{data.points_forts.length > 1 ? "s" : ""} identifié{data.points_forts.length > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.points_forts.map(toPoint).map((p, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.15)",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <span style={{
                        width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
                        background: "rgba(22,163,74,0.15)", color: "#16a34a",
                        fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>{p.text}</p>
                        {p.evidence && (
                          <p style={{
                            fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)",
                            fontStyle: "italic", marginTop: 6, paddingLeft: 10,
                            borderLeft: "2px solid rgba(22,163,74,0.4)", margin: "6px 0 0 0",
                          }}>
                            « {p.evidence} »
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Points Faibles */}
            {data.points_faibles?.length > 0 && (
              <div style={{
                background: "var(--bg2)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: 16,
                overflow: "hidden",
              }}>
                <div style={{
                  background: "rgba(217,119,6,0.10)", borderBottom: "1px solid rgba(217,119,6,0.20)",
                  padding: "16px 24px", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>△</span>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      Points d'Amélioration
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(217,119,6,0.7)" }}>
                      {data.points_faibles.length} élément{data.points_faibles.length > 1 ? "s" : ""} à corriger
                    </p>
                  </div>
                </div>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.points_faibles.map(toPoint).map((p, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      background: "rgba(217,119,6,0.05)", border: "1px solid rgba(217,119,6,0.15)",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <span style={{
                        width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
                        background: "rgba(217,119,6,0.15)", color: "#d97706",
                        fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>{p.text}</p>
                        {p.evidence && (
                          <p style={{
                            fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)",
                            fontStyle: "italic", paddingLeft: 10,
                            borderLeft: "2px solid rgba(217,119,6,0.4)", margin: "6px 0 0 0",
                          }}>
                            « {p.evidence} »
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recommandations — full width */}
          {data.recommandations?.length > 0 && (
            <div style={{
              background: "var(--bg2)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 16,
              overflow: "hidden", marginBottom: 20,
            }}>
              <div style={{
                background: "rgba(59,130,246,0.08)", borderBottom: "1px solid rgba(59,130,246,0.20)",
                padding: "16px 24px", display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>◆</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Recommandations IA
                  </p>
                  <p style={{ fontSize: 10, color: "rgba(59,130,246,0.7)" }}>
                    {data.recommandations.length} action{data.recommandations.length > 1 ? "s" : ""} stratégique{data.recommandations.length > 1 ? "s" : ""} suggérée{data.recommandations.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {data.recommandations.map(toReco).map((rv, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <span style={{
                      width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
                      background: "rgba(59,130,246,0.15)", color: "#3b82f6",
                      fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>{rv.text}</p>
                      {rv.brand_element && (
                        <span style={{
                          display: "inline-block", marginTop: 7,
                          fontSize: 10, fontWeight: 700, padding: "2px 9px",
                          background: "rgba(59,130,246,0.12)", color: "#60a5fa",
                          border: "1px solid rgba(59,130,246,0.28)", borderRadius: 100,
                        }}>
                          ⊞ {rv.brand_element}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════ BOTTOM ACTIONS ══════════════════════════════ */}
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: "6px 16px" }} onClick={handleReturn}>
              {convId ? "← Retour à la conversation" : "← Retour à l'historique"}
            </button>
            {!admin && !brandAdmin && (
              <button className="btn-primary" style={{ fontSize: 12, padding: "6px 16px" }} onClick={() => nav("/analyze")}>
                + Nouvelle analyse
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
