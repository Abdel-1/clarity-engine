import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBrandDashboard, getAnalyses } from "../../services/brandSystems";
import AppSidebar from "../../components/AppSidebar";
import ComparisonPanel from "../../components/ComparisonPanel";
import type { CompareEntity, CompareMetric } from "../../components/ComparisonPanel";
import TimelineVolumeChart from "../../components/TimelineVolumeChart";
import InfoTip from "../../components/InfoTip";
import Select from "../../components/Select";

/* ── Types ─────────────────────────────────────────────────────── */
interface TrendPoint { id: number; date: string | null; score: number; title: string; analyzed_by?: string | null }
interface PassFail { passed: number; failed: number; total: number; pass_rate: number }
interface RiskRate { high_count: number; total: number; rate: number }
interface WeakCriterion { criterion: string; avg: number; max: number }
interface ByDimension { label: string; avg_score: number; count: number }
interface RiskConc { user: string; high: number; total: number; rate: number }
interface UserRow { user: string; count: number; avg_score: number; avg_iterations: number }
interface Unreviewed { id: number; title: string; score: number; date: string | null; author: string | null }
interface RawAnalysis { analyzed_at: string | null; analyzed_by: string | null; clarity_score: number }
interface DashData {
  company_name: string;
  total: number;
  avg_score: number;
  avg_score_start: number | null;
  avg_score_end: number | null;
  score_trend: TrendPoint[];
  score_distribution: Record<string, number>;
  risk_rate: RiskRate;
  pass_fail: PassFail;
  most_violated_rules: WeakCriterion[];
  high_risk_frequency: number;
  risk_concentration: RiskConc[];
  unreviewed_high_risk: Unreviewed[];
  weak_criteria: WeakCriterion[];
  per_user: UserRow[];
  first_pass_rate: number;
  score_by_channel: ByDimension[];
  score_by_type: ByDimension[];
  resubmission_rate: number;
  avg_iterations_to_pass: number | null;
  collaboration_rate: number;
  best_improvement: number | null;
  weakest_improvement: number | null;
}

const NAV = [
  { path: "/brand/dashboard", label: "Tableau de bord", icon: "⬡" },
  { path: "/brand/users",     label: "Équipe",           icon: "◎" },
  { path: "/history",         label: "Historique",       icon: "◷" },
];

const scoreColor = (s: number) => s >= 75 ? "#2ec88c" : s >= 50 ? "#f0a832" : "#e05252";
const DONUT_COLORS: Record<string, string> = { "0-25": "#e05252", "25-50": "#f0a832", "50-75": "#4e8ef7", "75-100": "#2ec88c" };
const DONUT_LABELS: Record<string, string> = { "0-25": "Critique", "25-50": "Faible", "50-75": "Acceptable", "75-100": "Conforme" };

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ label, value, icon, color, sub, tooltip, onClick }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
  tooltip?: string; onClick?: () => void;
}) {
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
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          {label}
          {tooltip && <InfoTip text={tooltip} align="center" />}
        </span>
        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 30, fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* ── Mini Bar Chart ────────────────────────────────────────────── */
function MiniChart({ data, onBarClick }: { data: TrendPoint[]; onBarClick?: (id: number) => void }) {
  if (!data.length) return <div style={{ color: "var(--text-dim)", fontSize: 12, padding: 20 }}>Pas encore de données</div>;
  const h = 130;
  return (
    <div style={{ display: "flex", gap: 8, height: h, width: "100%", paddingTop: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", color: "var(--text-dim)", fontSize: 10 }}>
        <span style={{ lineHeight: 1, marginTop: -4 }}>100%</span>
        <span style={{ lineHeight: 1 }}>50%</span>
        <span style={{ lineHeight: 1, marginBottom: -4 }}>0%</span>
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "flex-end", gap: 3 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: "1px dashed var(--border)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed var(--border)", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--border)", zIndex: 0 }} />
        {data.map((d, i) => (
          <div key={i} title={`${d.title}\n${d.score}/100 — ${d.date}`}
            onClick={() => onBarClick?.(d.id)}
            style={{
              flex: 1, maxWidth: 30, height: `${Math.max(4, d.score)}%`, borderRadius: "4px 4px 0 0",
              background: `linear-gradient(180deg, ${scoreColor(d.score)}, ${scoreColor(d.score)}88)`,
              transition: "height 0.5s ease", cursor: "pointer", zIndex: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Donut Chart ───────────────────────────────────────────────── */
function DonutChart({ dist, total }: { dist: Record<string, number>; total: number }) {
  const r = 50, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = Object.entries(dist).filter(([, v]) => v > 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        {slices.map(([key, count]) => {
          const pct = total ? count / total : 0;
          const dash = pct * circ;
          const el = (
            <circle key={key} cx={cx} cy={cy} r={r} fill="none"
              stroke={DONUT_COLORS[key] || "#666"} strokeWidth={16}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text)" fontFamily="'Lora',serif" fontSize={22} fontWeight={600}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-dim)" fontSize={9}>analyses</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slices.map(([key, count]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: DONUT_COLORS[key] }} />
            <span style={{ fontSize: 12, color: "var(--text)" }}>{DONUT_LABELS[key]} <span style={{ color: "var(--text-dim)" }}>({count})</span></span>
          </div>
        ))}
      </div>
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

/* ── Member filter dropdown ─────────────────────────────────────── */
function MemberFilter({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="Tous les membres"
      ariaLabel="Filtrer par membre"
      options={options.map(o => ({ value: o, label: o }))}
    />
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function BrandDashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMember, setTrendMember] = useState("");  // "" = all members

  /* Full analysis history (beyond the dashboard's last-20 trend), used to chart
     analysis volume over time and to derive richer per-member comparison stats */
  const [allAnalyses, setAllAnalyses] = useState<RawAnalysis[]>([]);

  /* Member-vs-member comparison */
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  function toggleCompare(user: string) {
    setCompareSet(prev => {
      const next = new Set(prev);
      if (next.has(user)) next.delete(user); else next.add(user);
      return next;
    });
  }

  const load = () => {
    setLoading(true);
    getBrandDashboard()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e?.message ? String(e.message) : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { getAnalyses({}).then(setAllAnalyses); }, []);

  /* Last-20 trend, with the option to narrow to a single member */
  const trendPoints  = data?.score_trend ?? [];
  const trendMembers = Array.from(new Set(trendPoints.map(p => p.analyzed_by).filter((n): n is string => !!n))).sort();
  const trendData    = trendPoints.filter(p => !trendMember || p.analyzed_by === trendMember);

  /* Per-member stats derived from the full history — feeds richer comparison
     criteria (compliance, best score, consistency, recency) that aren't in the
     dashboard's aggregate payload. */
  const memberStats = (() => {
    const m = new Map<string, { scores: number[]; lastAt: string }>();
    for (const a of allAnalyses) {
      const key = a.analyzed_by;
      if (!key) continue;
      const e = m.get(key) ?? { scores: [], lastAt: "" };
      e.scores.push(a.clarity_score);
      if (a.analyzed_at && a.analyzed_at > e.lastAt) e.lastAt = a.analyzed_at;
      m.set(key, e);
    }
    const stats = new Map<string, { passRate: number; bestScore: number; consistency: number; daysSince: number }>();
    const now = Date.now();
    for (const [user, e] of m) {
      const passRate = e.scores.length ? (e.scores.filter(s => s >= 75).length / e.scores.length) * 100 : 0;
      const bestScore = e.scores.length ? Math.max(...e.scores) : 0;
      const mean = e.scores.reduce((s, v) => s + v, 0) / (e.scores.length || 1);
      const variance = e.scores.reduce((s, v) => s + (v - mean) ** 2, 0) / (e.scores.length || 1);
      const consistency = Math.max(0, 100 - Math.sqrt(variance));  // higher = steadier
      const daysSince = e.lastAt ? Math.floor((now - new Date(e.lastAt).getTime()) / 86400000) : 9999;
      stats.set(user, { passRate, bestScore, consistency, daysSince });
    }
    return stats;
  })();

  /* Comparison metrics — score, volume, compliance, best, consistency, iterations, risk */
  const compareMetrics: CompareMetric[] = [
    { key: "score",       label: "Score moyen",          higherIsBetter: true,  format: v => `${Math.round(v)}/100` },
    { key: "volume",      label: "Volume (analyses)",     higherIsBetter: true,  format: v => `${Math.round(v)}` },
    { key: "passRate",    label: "Taux de conformité",    higherIsBetter: true,  format: v => `${Math.round(v)}%` },
    { key: "bestScore",   label: "Meilleur score",        higherIsBetter: true,  format: v => `${Math.round(v)}/100` },
    { key: "consistency", label: "Régularité",            higherIsBetter: true,  format: v => `${Math.round(v)}/100` },
    { key: "iterations",  label: "Itérations moyennes",   higherIsBetter: false, format: v => v.toFixed(1) },
    { key: "riskRate",    label: "Taux de risque élevé",  higherIsBetter: false, format: v => `${Math.round(v)}%` },
  ];
  const compareEntities: CompareEntity[] = (data?.per_user ?? [])
    .filter(u => compareSet.has(u.user))
    .map(u => {
      const rc = data?.risk_concentration.find(x => x.user === u.user);
      const st = memberStats.get(u.user);
      return {
        key: u.user,
        name: u.user,
        metrics: {
          score: u.avg_score,
          volume: u.count,
          passRate: st?.passRate ?? 0,
          bestScore: st?.bestScore ?? 0,
          consistency: st?.consistency ?? 0,
          iterations: u.avg_iterations ?? 0,
          riskRate: rc?.rate ?? 0,
        },
      };
    });

  return (
    <div className="dashboard-root">
      <AppSidebar role="brand_admin" companyName={data?.company_name} navItems={NAV} />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", padding: 28 }}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4, fontFamily: "'Lora', serif" }}>
                Tableau de bord
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {data?.company_name || "—"} · Vue d'ensemble de la conformité
              </p>
            </div>
            <button onClick={() => nav("/brand/users")} style={{
              padding: "10px 18px", borderRadius: 10, background: "rgba(46,200,140,0.1)",
              border: "1px solid rgba(46,200,140,0.2)", color: "#2ec88c",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              ◎ Gérer l'équipe
            </button>
          </div>

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", padding: "60px 0" }}>
              <div className="spinner" style={{ borderTopColor: "#2ec88c" }} /> Chargement…
            </div>
          )}

          {!loading && error && (
            <div style={{ background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.3)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#e05252", fontWeight: 600 }}>Impossible de charger le tableau de bord.</p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{error}</p>
              <button onClick={load} style={{ marginTop: 10, background: "#2ec88c", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Réessayer
              </button>
            </div>
          )}

          {!loading && data && (
            <>
              {/* ═══ HIGH KPI ROW ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                <StatCard label="Total analyses" value={data.total} icon="▦" color="#4e8ef7" tooltip="Nombre total d'analyses de contenu soumises par les membres de votre organisation." />

                <StatCard label="Score moyen" value={`${data.avg_score}/100`} icon="◎" color={scoreColor(data.avg_score)} sub="toutes analyses" tooltip="Score de clarté moyen sur l'ensemble des analyses de votre marque (de 0 à 100)." />

                <StatCard label="Taux conformité" value={data.pass_fail ? `${data.pass_fail.pass_rate}%` : "—"} icon="✓" color={(data.pass_fail?.pass_rate ?? 0) >= 70 ? "#2ec88c" : "#f0a832"} sub={data.pass_fail ? `${data.pass_fail.passed}/${data.pass_fail.total}` : ""} tooltip="Part des analyses jugées conformes, c'est-à-dire atteignant un score d'au moins 75/100." />
                <StatCard
                  label="Non-révisés"
                  value={(data.unreviewed_high_risk ?? []).length}
                  icon="●"
                  color={(data.unreviewed_high_risk ?? []).length > 0 ? "#e05252" : "#2ec88c"}
                  sub="risques sans suivi"
                  tooltip="Contenus classés à risque élevé qui n'ont jamais été corrigés ni rouverts. Cliquez pour voir la liste."
                  onClick={() => nav("/unreviewed")}
                />
              </div>

              {/* ═══ TREND + DISTRIBUTION ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14, marginBottom: 16 }}>
                {/* Score Trend */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
                      Scores des 20 dernières analyses
                      <InfoTip text="Score de clarté des 20 analyses les plus récentes, de la plus ancienne à la plus récente. Filtrez par membre ; cliquez sur une barre pour ouvrir l'analyse." />
                    </p>
                    <MemberFilter value={trendMember} options={trendMembers} onChange={setTrendMember} />
                  </div>
                  <MiniChart data={trendData} onBarClick={(id) => nav(`/analysis/${id}`)} />
                </div>

                {/* Score Distribution Donut */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                    Distribution des Scores
                    <InfoTip align="right" text="Répartition de toutes les analyses par tranche de score : Critique (0-25), Faible (25-50), Acceptable (50-75) et Conforme (75-100)." />
                  </p>
                  <DonutChart dist={data.score_distribution} total={data.total} />
                </div>
              </div>

              {/* ═══ RULES + RISK CONCENTRATION ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                {/* Most Violated Rules */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                    Performance par critère /20
                    <InfoTip text="Score moyen obtenu sur chaque critère d'évaluation (noté sur 20). Les critères les plus bas signalent les axes de marque à renforcer en priorité." />
                  </p>
                  <CriteriaBars data={data.weak_criteria} />
                </div>

                {/* Risk Concentration by User */}
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                    Concentration des risques par utilisateur
                    <InfoTip align="right" text="Nombre de contenus à risque élevé et taux de risque par membre. Permet d'identifier les membres dont les soumissions posent le plus de problèmes de conformité." />
                  </p>
                  {data.risk_concentration.length === 0
                    ? <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Aucun risque détecté</p>
                    : data.risk_concentration.map(rc => (
                      <div key={rc.user} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(224,82,82,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#e05252", flexShrink: 0 }}>
                          {rc.high}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rc.user}</p>
                          <p style={{ fontSize: 10, color: "var(--text-dim)" }}>{rc.total} analyses · {rc.rate}% à risque</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* ═══ UNREVIEWED HIGH RISK — clickable list ═══ */}
              {(data.unreviewed_high_risk ?? []).length > 0 && (
                <div style={{ background: "var(--bg2)", border: "1px solid rgba(224,82,82,0.2)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#e05252", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>
                    Soumissions à risque élevé non révisées
                    <InfoTip text="Contenus classés à risque élevé qui n'ont jamais été corrigés ni rouverts. Cliquez sur une ligne pour ouvrir l'analyse concernée." />
                  </p>
                  <table className="doc-table">
                    <thead><tr><th>Date</th><th>Titre</th><th>Auteur</th><th>Score</th></tr></thead>
                    <tbody>
                      {(data.unreviewed_high_risk ?? []).map(u => (
                        <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => nav(`/analysis/${u.id}`)}>
                          <td className="td-muted">{u.date}</td>
                          <td className="td-bold" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</td>
                          <td className="td-muted">{u.author || "—"}</td>
                          <td><span style={{ padding: "2px 10px", borderRadius: 100, background: "rgba(224,82,82,0.15)", color: "#e05252", fontWeight: 700, fontSize: 13 }}>{u.score}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ═══ PER USER TABLE ═══ */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
                      Performance par utilisateur
                      <InfoTip text="Volume d'analyses et score de clarté moyen de chaque membre. Cochez deux membres ou plus pour les comparer en détail." />
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {compareSet.size > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {compareSet.size} sélectionné{compareSet.size > 1 ? "s" : ""}
                        </span>
                      )}
                      <button
                        disabled={compareSet.size < 2}
                        onClick={() => setShowCompare(v => !v)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
                          border: "1px solid rgba(46,200,140,0.3)",
                          background: compareSet.size >= 2 ? "rgba(46,200,140,0.12)" : "transparent",
                          color: compareSet.size >= 2 ? "#2ec88c" : "var(--text-dim)",
                          cursor: compareSet.size >= 2 ? "pointer" : "not-allowed",
                          fontFamily: "inherit",
                        }}
                      >
                        ⇄ {showCompare ? "Masquer la comparaison" : "Comparer"}
                      </button>
                    </div>
                  </div>
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>Utilisateur</th>
                        <th>Analyses</th>
                        <th>Score moy.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.per_user.map(u => (
                        <tr key={u.user}>
                          <td>
                            <input
                              type="checkbox"
                              checked={compareSet.has(u.user)}
                              onChange={() => toggleCompare(u.user)}
                              style={{ cursor: "pointer" }}
                              title="Sélectionner pour comparer"
                            />
                          </td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(46,200,140,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2ec88c" }}>
                                {u.user.slice(0, 1).toUpperCase()}
                              </span>
                              <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{u.user}</span>
                            </span>
                          </td>
                          <td className="td-muted">{u.count}</td>
                          <td><span style={{ color: scoreColor(u.avg_score), fontWeight: 600 }}>{u.avg_score}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ═══ MEMBER COMPARISON ═══ */}
              {showCompare && compareEntities.length >= 2 && (
                <ComparisonPanel
                  title="Comparaison des membres"
                  subtitle="Tête-à-tête : score, volume, conformité, meilleur score, régularité, itérations et risque"
                  accentColor="#2ec88c"
                  entities={compareEntities}
                  metrics={compareMetrics}
                  onRemove={toggleCompare}
                  onClose={() => setShowCompare(false)}
                />
              )}

              {/* ═══ ANALYSIS VOLUME OVER TIME ═══ */}
              <TimelineVolumeChart
                title="Nombre d'analyses par période"
                infoText="Volume d'analyses soumises au fil du temps. Choisissez le pas (jour, semaine, mois, année), filtrez par membre ou restreignez à une plage de dates."
                items={allAnalyses.map(a => ({ analyzed_at: a.analyzed_at, series: a.analyzed_by }))}
                seriesLabel="Tous les membres"
                accentColor="#2ec88c"
                barColor="#4e8ef7"
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

