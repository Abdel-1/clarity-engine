import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMemberDashboard } from "../services/brandSystems";
import AppSidebar from "../components/AppSidebar";
import InfoTip from "../components/InfoTip";

/* ── Types ─────────────────────────────────────────────────────── */
interface TrendPoint { id: number; date: string | null; score: number; title: string }
interface PassFail { passed: number; failed: number; total: number; pass_rate: number }
interface RiskRate { high_count: number; total: number; rate: number }
interface WeakCriterion { criterion: string; avg: number; max: number }
interface TopScorer { id: number; title: string; score: number; date: string | null }
interface DashData {
  score_trend: TrendPoint[];
  pass_fail: PassFail;
  risk_rate: RiskRate;
  best_improvement: number | null;
  weakest_improvement: number | null;
  top_scorers: TopScorer[];
  total: number;
  avg_score: number;
  avg_score_start: number | null;
  avg_score_end: number | null;
  unreviewed_count: number;
  first_pass_rate: number;
  most_problematic_criterion: string | null;
  improvement_velocity: number | null;
  consistency_score: number | null;
  weak_criteria: WeakCriterion[];
  score_by_type: { label: string; avg_score: number; count: number }[];
}

const NAV = [
  { path: "/",        label: "Tableau de bord", icon: "⬡" },
  { path: "/analyze", label: "Analyser",          icon: "✦" },
  { path: "/history", label: "Historique",        icon: "◷" },
];

const scoreColor = (s: number) =>
  s >= 75 ? "var(--score-high-fg)" : s >= 50 ? "var(--score-mid-fg)" : "var(--score-low-fg)";

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ label, value, icon, color, sub, tooltip, onClick }: {
  label: string; value: string | number; icon: string; color: string; sub?: string; tooltip?: string; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="stat-card"
      style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "22px 20px 18px",
        // Top accent drawn as an inset shadow: it follows the card's rounded
        // corners cleanly without `overflow: hidden`, which would clip the
        // KPI hover tooltip.
        boxShadow: `inset 0 3px 0 0 ${color}`,
        position: "relative", contain: "layout",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s ease",
        borderColor: onClick && hovered ? color : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          {label}
          {tooltip && <InfoTip text={tooltip} align="center" />}
        </span>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, fontWeight: 400, color: "var(--gold-bright)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* ── Score Column Chart (SVG, 0→100, oldest→newest) ────────────── */
const BAND_COLOR = { high: "var(--score-high-fg)", mid: "var(--score-mid-fg)", low: "var(--score-low-fg)" } as const;
type Band = keyof typeof BAND_COLOR;
const bandOf = (s: number): Band => (s >= 75 ? "high" : s >= 50 ? "mid" : "low");

function ScoreCandleChart({ data, onBarClick }: { data: TrendPoint[]; onBarClick?: (id: number) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setW(Math.max(300, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data || !data.length)
    return <div style={{ color: "var(--text-dim)", fontSize: 12, padding: "8px 0" }}>Pas encore d'analyses</div>;

  const H = 240;
  const PAD = { l: 36, r: 14, t: 22, b: 30 };
  const plotW = Math.max(1, w - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.max(7, Math.min(slot * 0.62, 22));
  const clamp = (s: number) => Math.min(100, Math.max(0, s));
  const yFor = (s: number) => PAD.t + (1 - clamp(s) / 100) * plotH;
  const baseY = yFor(0);
  const grid = [0, 25, 50, 75, 100];

  // Column with softly rounded top corners and a flat base on the axis.
  const colPath = (x: number, y: number, ww: number, hh: number, r: number) => {
    const rr = Math.max(0, Math.min(r, ww / 2, hh));
    return `M${x},${y + hh} L${x},${y + rr} Q${x},${y} ${x + rr},${y} `
         + `L${x + ww - rr},${y} Q${x + ww},${y} ${x + ww},${y + rr} L${x + ww},${y + hh} Z`;
  };

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <svg width={w} height={H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {(Object.keys(BAND_COLOR) as Band[]).map(k => (
            <linearGradient key={k} id={`scg-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   style={{ stopColor: BAND_COLOR[k], stopOpacity: 0.85 }} />
              <stop offset="100%" style={{ stopColor: BAND_COLOR[k], stopOpacity: 0.32 }} />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines + Y labels */}
        {grid.map(g => {
          const y = yFor(g);
          return (
            <g key={g}>
              <line x1={PAD.l} y1={y} x2={w - PAD.r} y2={y}
                stroke="var(--border)" strokeWidth={1} opacity={g === 0 ? 0.6 : 0.26} />
              <text x={PAD.l - 9} y={y + 3.5} textAnchor="end" fontSize={10} fill="var(--text-dim)">{g}</text>
            </g>
          );
        })}

        {/* Columns */}
        {data.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          const x = cx - barW / 2;
          const yTop = yFor(d.score);
          const hh = Math.max(2, baseY - yTop);
          const b = bandOf(d.score);
          const active = hov === i;
          return (
            <g key={d.id} style={{ cursor: "pointer" }}
              onClick={() => onBarClick?.(d.id)}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(h => (h === i ? null : h))}>
              <title>{`${d.title?.trim() || "Sans titre"}\n${d.score}/100${d.date ? " — " + d.date : ""}`}</title>
              <path d={colPath(x, yTop, barW, hh, 3)}
                fill={`url(#scg-${b})`}
                stroke={BAND_COLOR[b]} strokeOpacity={active ? 0.95 : 0.4} strokeWidth={1} />
              {active && (
                <text x={cx} y={yTop - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill={BAND_COLOR[b]}>{d.score}</text>
              )}
              {/* full-slot transparent hit area for easy hover/click */}
              <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={plotH} fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Criteria Bars ─────────────────────────────────────────────── */
function CriteriaBars({ data }: { data: WeakCriterion[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map(c => {
        const pct = (c.avg / c.max) * 100;
        return (
          <div key={c.criterion}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{c.criterion}</span>
              <span style={{ fontSize: 11, color: scoreColor(pct) }}>{c.avg}/{c.max}</span>
            </div>
            <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: scoreColor(pct), borderRadius: 3, transition: "width 1s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMemberDashboard()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e?.message ? String(e.message) : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard-root">
      <AppSidebar role="membre" navItems={NAV} />

      <main className="dashboard-main">
        <div>
          {/* Header */}
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Tableau de bord</h1>
              <p className="dash-subtitle">Vos performances d'analyse de communication</p>
            </div>
            <a href="/analyze" className="btn-primary" onClick={e => { e.preventDefault(); nav("/analyze"); }}>
              + Nouvelle analyse
            </a>
          </header>

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", padding: "60px 0" }}>
              <div className="spinner" /> Chargement…
            </div>
          )}

          {!loading && error && (
            <div style={{ background: "var(--score-low-bg)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "var(--score-low-fg)", fontWeight: 600 }}>Impossible de charger les données du tableau de bord.</p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{error}</p>
              <button onClick={() => { setLoading(true); getMemberDashboard().then((d) => { setData(d); setError(null); }).catch((e) => setError(e?.message ? String(e.message) : String(e))).finally(() => setLoading(false)); }}
                style={{ marginTop: 10, background: "var(--gold)", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Réessayer
              </button>
            </div>
          )}

          {!loading && data && (
            <>
              {/* ═══ HIGH KPI ROW ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                <StatCard label="Total analyses" value={data.total} icon="▦" color="var(--gold)" sub="vos soumissions" tooltip="Nombre total d'analyses soumises" />

                <StatCard
                  label="Score moyen"
                  value={data.avg_score > 0 ? `${data.avg_score}/100` : "—"}
                  icon="◎"
                  color={data.avg_score > 0 ? scoreColor(data.avg_score) : "var(--text-dim)"}
                  sub="moyenne de vos analyses"
                  tooltip="Score de clarté moyen sur toutes vos analyses"
                />

                <StatCard label="Taux de conformité" value={`${data.pass_fail.pass_rate}%`} icon="✓" color={data.pass_fail.pass_rate >= 70 ? "var(--score-high-fg)" : "var(--score-mid-fg)"} sub={`${data.pass_fail.passed} conforme${data.pass_fail.passed !== 1 ? "s" : ""} / ${data.pass_fail.total}`} tooltip="Pourcentage d'analyses atteignant ≥75/100" />
                <StatCard
                  label="Non-révisés"
                  value={data.unreviewed_count ?? 0}
                  icon="●"
                  color={(data.unreviewed_count ?? 0) > 0 ? "var(--score-low-fg)" : "var(--score-high-fg)"}
                  sub="risques sans suivi"
                  tooltip="Contenus à risque élevé jamais corrigés"
                  onClick={() => nav("/unreviewed")}
                />
              </div>

              {/* ═══ SECONDARY KPI ROW ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
                <StatCard
                  label="Taux de risque élevé"
                  value={`${data.risk_rate.rate}%`}
                  icon="△"
                  color={data.risk_rate.rate > 20 ? "var(--score-low-fg)" : data.risk_rate.rate > 0 ? "var(--score-mid-fg)" : "var(--score-high-fg)"}
                  sub={`${data.risk_rate.high_count} sur ${data.risk_rate.total}`}
                  tooltip="Part de vos analyses classées « risque élevé »"
                />
                <StatCard
                  label="Vélocité d'amélioration"
                  value={data.improvement_velocity != null ? `${data.improvement_velocity > 0 ? "+" : ""}${data.improvement_velocity}` : "—"}
                  icon="↗"
                  color={data.improvement_velocity == null ? "var(--text-dim)" : data.improvement_velocity > 0 ? "var(--score-high-fg)" : data.improvement_velocity < 0 ? "var(--score-low-fg)" : "var(--score-mid-fg)"}
                  sub="pts gagnés / réécriture"
                  tooltip="Points moyens gagnés entre une analyse et sa réécriture"
                />
                <StatCard
                  label="Progression moyenne"
                  value={data.avg_score_start != null && data.avg_score_end != null ? `${data.avg_score_start > 0 && data.avg_score_end - data.avg_score_start >= 0 ? "+" : ""}${Math.round((data.avg_score_end - data.avg_score_start) * 10) / 10}` : "—"}
                  icon="◷"
                  color={data.avg_score_start == null || data.avg_score_end == null ? "var(--text-dim)" : data.avg_score_end >= data.avg_score_start ? "var(--score-high-fg)" : "var(--score-low-fg)"}
                  sub={data.avg_score_start != null && data.avg_score_end != null ? `${data.avg_score_start} → ${data.avg_score_end}` : "départ → arrivée"}
                  tooltip="Score moyen de départ comparé au score moyen après réécriture"
                />
              </div>

              {/* ═══ SCORES CHART ═══ */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 10, padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Scores des 20 dernières analyses
                    </p>
                    <span style={{ fontSize: 10, color: "var(--text-dim)" }}>ancien → récent · /100</span>
                  </div>
                  <ScoreCandleChart data={data.score_trend} onBarClick={(id) => nav(`/analysis/${id}`)} />
                </div>
              </div>

              {/* ═══ CRITERIA ═══ */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 10, padding: "20px 22px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                    Performance par critère <span style={{ fontSize: 9, fontWeight: 400 }}>/20</span>
                  </p>
                  <CriteriaBars data={data.weak_criteria} />
                  {data.most_problematic_criterion && (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--score-low-bg)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6 }}>
                      <p style={{ fontSize: 11, color: "var(--score-low-fg)" }}>
                        Critère le plus problématique : <strong>{data.most_problematic_criterion}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ TOP SCORERS ═══ */}
              {data.top_scorers.length > 0 && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 10, padding: "18px 22px", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Contenus 95+</p>
                  {data.top_scorers.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < data.top_scorers.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                      onClick={() => nav(`/analysis/${t.id}`)}>
                      <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: "1.1rem", fontWeight: 400, color: "var(--gold-bright)", minWidth: 50 }}>{t.score}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t.title}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.date}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="quick-actions" style={{ marginTop: 4 }}>
                {[
                  { path: "/analyze", icon: "✦", label: "Analyser un message", sub: "Évaluer contre votre Brand System" },
                  { path: "/history", icon: "◷", label: "Historique", sub: "Toutes vos conversations d'analyse" },
                ].map(a => (
                  <a key={a.path} href={a.path} className="quick-card"
                    onClick={e => { e.preventDefault(); nav(a.path); }}>
                    <span className="quick-icon">{a.icon}</span>
                    <p className="quick-label">{a.label}</p>
                    <p className="quick-sub">{a.sub}</p>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
