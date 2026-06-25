import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminDashboard, getAdminTokenUsage, getAnalyses } from "../../services/brandSystems";
import type { TokenUsage } from "../../services/brandSystems";
import AppSidebar from "../../components/AppSidebar";
import ComparisonPanel from "../../components/ComparisonPanel";
import type { CompareEntity, CompareMetric } from "../../components/ComparisonPanel";
import TimelineVolumeChart from "../../components/TimelineVolumeChart";
import InfoTip from "../../components/InfoTip";
import Select from "../../components/Select";

/* ── Types ─────────────────────────────────────────────────────── */
interface BrandHealth {
  client_id: number; company_name: string; total_analyses: number;
  avg_score: number; pass_rate: number; high_risk_count: number; unreviewed_high_risk_count: number;
  avg_improvement: number | null; avg_iterations: number | null;
}
interface RawAnalysis { analyzed_at: string | null; brand_system_name: string | null }
interface Unreviewed { id: number; title: string; score: number; date: string | null; author: string | null; brand_system_id?: number | null; brand_system_name?: string | null }
interface TrendPoint { id: number; date: string | null; score: number; title: string; brand_system_id?: number | null; brand_system_name?: string | null }
interface UserPerf { user: string; count: number; avg_score: number; company_name: string }
interface DashData {
  total_analyses: number; total_clients: number; total_users: number; avg_score: number;
  avg_score_start: number | null; avg_score_end: number | null;
  unreviewed_count: number;
  brand_health: BrandHealth[];
  high_risk_frequency: number; high_risk_rate: number;
  unreviewed_high_risk: Unreviewed[];
  governance_coverage: number;
  per_user: UserPerf[];
  score_distribution: Record<string, number>;
  score_trend: TrendPoint[];
}

const NAV = [
  { path: "/admin/clients",   label: "Clients",     icon: "◈" },
  { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
  { path: "/history",         label: "Historique",  icon: "◷" },
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
  const h = 120;
  return (
    <div style={{ display: "flex", gap: 8, height: h, width: "100%", paddingTop: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", color: "var(--text-dim)", fontSize: 10 }}>
        <span style={{ lineHeight: 1, marginTop: -4 }}>100%</span>
        <span style={{ lineHeight: 1 }}>50%</span>
        <span style={{ lineHeight: 1, marginBottom: -4 }}>0%</span>
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "flex-end", gap: 2 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: "1px dashed var(--border)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed var(--border)", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--border)", zIndex: 0 }} />
        {data.map((d, i) => (
          <div key={i} title={`${d.title}\n${d.score}/100 — ${d.date}`}
            onClick={() => onBarClick?.(d.id)}
            style={{
              flex: 1, maxWidth: 16, height: `${Math.max(4, d.score)}%`, borderRadius: "3px 3px 0 0",
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
  const r = 44, cx = 54, cy = 54;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = Object.entries(dist).filter(([, v]) => v > 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={108} height={108} viewBox="0 0 108 108">
        {slices.map(([key, count]) => {
          const pct = total ? count / total : 0;
          const dash = pct * circ;
          const el = (
            <circle key={key} cx={cx} cy={cy} r={r} fill="none"
              stroke={DONUT_COLORS[key] || "#666"} strokeWidth={14}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text)" fontFamily="'Lora',serif" fontSize={20} fontWeight={600}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-dim)" fontSize={8}>analyses</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {slices.map(([key, count]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[key] }} />
            <span style={{ fontSize: 11, color: "var(--text)" }}>{DONUT_LABELS[key]} <span style={{ color: "var(--text-dim)" }}>({count})</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Brand-system filter dropdown ───────────────────────────────── */
function BrandFilter({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="Toutes les marques"
      ariaLabel="Filtrer par marque"
      options={options.map(o => ({ value: o, label: o }))}
    />
  );
}

/* ── API token consumption per brand system (date + brand filters) ── */
function TokenPanel() {
  const [start, setStart]   = useState("");
  const [end, setEnd]       = useState("");
  const [brandId, setBrandId] = useState("");   // selected brand_system_id (as string for <Select>)
  const [tu, setTu]         = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAdminTokenUsage({ start: start || undefined, end: end || undefined, brandSystemId: brandId ? Number(brandId) : undefined })
      .then(d => { if (alive) setTu(d); })
      .catch(() => { if (alive) setTu(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [start, end, brandId]);

  const selectedBrand = tu?.brand_systems.find(b => String(b.id) === brandId)?.name;

  const fmt = (n: number) => n.toLocaleString("fr-FR");
  const currency = tu?.pricing?.currency || "USD";
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency", currency,
        minimumFractionDigits: 2, maximumFractionDigits: 4,
      }).format(n);
    } catch {
      return `${n.toFixed(4)} ${currency}`;
    }
  };
  const inputStyle = {
    // `width: "auto"` overrides the global `input, select { width: 100% }` rule
    // in index.css — without it these date inputs stretch to fill the row.
    width: "auto",
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "6px 10px", fontSize: 12, color: "var(--text)", fontFamily: "inherit", outline: "none",
  } as const;
  const barColor = (i: number) => ["#4e8ef7", "#7c3aed", "#2ec88c", "#e0a052", "#e05252", "#22b8cf"][i % 6];

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
          Coût API par Brand System
          <InfoTip text="Coût des tokens consommés par les analyses, ventilé par Brand System. Filtrable par période et par Brand System. Le suivi démarre à son activation : les analyses antérieures comptent pour 0." />
        </p>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>Du</label>
          <input type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} style={inputStyle} />
          <label style={{ fontSize: 11, color: "var(--text-dim)" }}>au</label>
          <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} style={inputStyle} />
          <Select
            value={brandId}
            onChange={setBrandId}
            placeholder="Tous les Brand Systems"
            ariaLabel="Filtrer par Brand System"
            size="md"
            style={{ maxWidth: 220 }}
            options={(tu?.brand_systems ?? []).map(b => ({
              value: String(b.id),
              label: b.name,
            }))}
          />
          {(start || end || brandId) && (
            <button onClick={() => { setStart(""); setEnd(""); setBrandId(""); }} style={{
              ...inputStyle, cursor: "pointer", color: "var(--text-dim)",
            }}>↺ Réinitialiser</button>
          )}
        </div>
      </div>

      {/* Total cost — analyses count as the supporting figure */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: "#2ec88c", fontFamily: "'Lora', serif" }}>
            {loading ? "…" : money(tu?.grand_total_cost ?? 0)}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            dépensés · {fmt(tu?.total_analyses ?? 0)} analyses{selectedBrand ? ` · ${selectedBrand}` : ""}
          </span>
        </div>
      </div>

      {/* Per-brand bars */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)", padding: "12px 0", fontSize: 13 }}>
          <div className="spinner" style={{ borderTopColor: "#4e8ef7" }} /> Chargement…
        </div>
      ) : (tu?.grand_total_tokens ?? 0) === 0 ? (
        <p style={{ color: "var(--text-dim)", fontSize: 13, padding: "8px 0" }}>
          Aucune consommation de tokens enregistrée sur cette période. Le suivi des tokens démarre avec
          les analyses effectuées après son activation ; les analyses antérieures comptent pour 0.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tu!.by_brand.map((b, i) => {
            // Bar reflects each brand system's share of total cost.
            const costPct = tu!.grand_total_cost ? (b.cost / tu!.grand_total_cost) * 100 : 0;
            return (
              <div key={b.brand_system_id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12.5 }}>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>{b.brand_system_name}</span>
                  <span style={{ color: "var(--text-dim)" }}>
                    <strong style={{ color: "#2ec88c" }}>{money(b.cost)}</strong> · {fmt(b.analyses)} analyses
                  </span>
                </div>
                <div style={{ height: 9, borderRadius: 100, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${costPct}%`, borderRadius: 100,
                    background: barColor(i), transition: "width .5s cubic-bezier(.4,0,.2,1)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10.5, color: "var(--text-dim)", marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
        Coût calculé aux tarifs. La barre indique la part de chaque Brand System dans le coût total
        sur la période / les brand sélectionnés.
      </p>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function AdminAnalytics() {
  const nav = useNavigate();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // "" = all brand systems
  const [trendBrand, setTrendBrand] = useState("");
  const [unreviewedBrand, setUnreviewedBrand] = useState("");

  /* Brand-vs-brand comparison */
  const [compareSet, setCompareSet] = useState<Set<number>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  function toggleCompare(clientId: number) {
    setCompareSet(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  }

  /* Full analysis history — drives the per-brand-system volume-over-time chart */
  const [allAnalyses, setAllAnalyses] = useState<RawAnalysis[]>([]);

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { getAnalyses({}).then(setAllAnalyses); }, []);

  // Distinct brand-system names present in a list (for the filter dropdowns)
  const brandOptions = (items: { brand_system_name?: string | null }[]) =>
    Array.from(new Set(items.map(i => i.brand_system_name).filter((n): n is string => !!n))).sort();

  const trendBrands      = brandOptions(data?.score_trend ?? []);
  const unreviewedBrands = brandOptions(data?.unreviewed_high_risk ?? []);
  const trendData        = (data?.score_trend ?? []).filter(p => !trendBrand || p.brand_system_name === trendBrand);
  const unreviewedData   = (data?.unreviewed_high_risk ?? []).filter(u => !unreviewedBrand || u.brand_system_name === unreviewedBrand);

  /* Comparison metrics — score, volume, compliance, improvement, iterations, risk */
  const compareMetrics: CompareMetric[] = [
    { key: "score",       label: "Score moyen",         higherIsBetter: true,  format: v => `${Math.round(v)}/100` },
    { key: "volume",      label: "Volume (analyses)",   higherIsBetter: true,  format: v => `${Math.round(v)}` },
    { key: "passRate",    label: "Taux de conformité",  higherIsBetter: true,  format: v => `${Math.round(v)}%` },
    { key: "improvement", label: "Progression moyenne", higherIsBetter: true,  format: v => `${v > 0 ? "+" : ""}${v.toFixed(1)}` },
    { key: "iterations",  label: "Itérations moyennes", higherIsBetter: false, format: v => v.toFixed(1) },
    { key: "highRisk",    label: "Risque élevé (nb)",   higherIsBetter: false, format: v => `${Math.round(v)}` },
    { key: "unreviewed",  label: "Non révisés",         higherIsBetter: false, format: v => `${Math.round(v)}` },
  ];
  const compareEntities: CompareEntity[] = (data?.brand_health ?? [])
    .filter(c => compareSet.has(c.client_id))
    .map(c => ({
      key: String(c.client_id),
      name: c.company_name,
      metrics: {
        score: c.avg_score,
        volume: c.total_analyses,
        passRate: c.pass_rate ?? 0,
        improvement: c.avg_improvement ?? 0,
        iterations: c.avg_iterations ?? 0,
        highRisk: c.high_risk_count,
        unreviewed: c.unreviewed_high_risk_count,
      },
    }));

  return (
    <div className="dashboard-root">
      <AppSidebar role="admin" navItems={NAV} />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", padding: 28 }}>
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4, fontFamily: "'Lora', serif" }}>
                Tableau de bord
              </h1>

            </div>
            <button onClick={() => nav("/admin/clients")} style={{
              padding: "10px 18px", borderRadius: 10, background: "rgba(78,142,247,0.1)",
              border: "1px solid rgba(78,142,247,0.2)", color: "#4e8ef7",
              fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              ◈ Gérer les clients
            </button>
          </div>

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", padding: "60px 0" }}>
              <div className="spinner" style={{ borderTopColor: "#4e8ef7" }} /> Chargement…
            </div>
          )}
          {error && <p style={{ color: "var(--danger)", padding: "24px 0" }}>{error}</p>}

          {!loading && data && (
            <>
              {/* ═══ HIGH KPI ROW ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
                <StatCard label="Total analyses" value={data.total_analyses} icon="▦" color="#4e8ef7" sub="plateforme" tooltip="Nombre total d'analyses de contenu soumises sur la plateforme, toutes organisations et tous membres confondus." />

                <StatCard label="Score moyen" value={`${data.avg_score}/100`} icon="◎" color={scoreColor(data.avg_score)} sub="toutes analyses" tooltip="Score de clarté moyen sur l'ensemble des analyses de la plateforme" />

                <StatCard label="Clients" value={data.total_clients} icon="◈" color="#7c3aed" sub="organisations" tooltip="Nombre d'organisations clientes actives" />
                <StatCard
                  label="Non-révisés"
                  value={data.unreviewed_count ?? (data.unreviewed_high_risk ?? []).length}
                  icon="●"
                  color={(data.unreviewed_count ?? (data.unreviewed_high_risk ?? []).length) > 0 ? "#e05252" : "#2ec88c"}
                  sub="risques sans suivi"
                  tooltip="Contenus classés à risque élevé qui n'ont jamais été corrigés ni rouverts après leur première analyse, toutes organisations confondues. Cliquez pour voir la liste."
                  onClick={() => nav("/unreviewed")}
                />
              </div>

              {/* ═══ SECONDARY KPI ROW ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 16 }}>
                <StatCard
                  label="Couverture gouvernance"
                  value={`${data.governance_coverage}%`}
                  icon="◇"
                  color={data.governance_coverage >= 75 ? "#2ec88c" : data.governance_coverage >= 40 ? "#f0a832" : "#e05252"}
                  sub="clients actifs"
                  tooltip="Part des organisations clientes ayant soumis au moins une analyse. Indique le taux d'adoption réel de la plateforme parmi les clients."
                />
                <StatCard
                  label="Membres"
                  value={data.total_users}
                  icon="◫"
                  color="#7c3aed"
                  sub="utilisateurs"
                  tooltip="Nombre total de membres (utilisateurs) sur la plateforme"
                />
              </div>

              {/* ═══ BRAND HEALTH TABLE ═══ */}
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
                    Résultat par marque
                    <InfoTip text="Vue d'ensemble par organisation cliente : nombre d'analyses soumises, score de clarté moyen et nombre de contenus à risque élevé non révisés. Cochez deux marques ou plus pour les comparer." />
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {compareSet.size > 0 && (
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        {compareSet.size} sélectionnée{compareSet.size > 1 ? "s" : ""}
                      </span>
                    )}
                    <button
                      disabled={compareSet.size < 2}
                      onClick={() => setShowCompare(v => !v)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 8,
                        border: "1px solid rgba(78,142,247,0.3)",
                        background: compareSet.size >= 2 ? "rgba(78,142,247,0.12)" : "transparent",
                        color: compareSet.size >= 2 ? "#4e8ef7" : "var(--text-dim)",
                        cursor: compareSet.size >= 2 ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                      }}
                    >
                      ⇄ {showCompare ? "Masquer la comparaison" : "Comparer"}
                    </button>
                  </div>
                </div>
                {data.brand_health.length === 0
                  ? <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Aucun client</p>
                  : (
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Organisation</th><th>Analyses</th><th>Score moy.</th>
                          <th>Non révisés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.brand_health.map(c => (
                          <tr key={c.client_id} className="table-row-clickable" onClick={() => nav(`/admin/clients/${c.client_id}`)}>
                            <td onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={compareSet.has(c.client_id)}
                                onChange={() => toggleCompare(c.client_id)}
                                style={{ cursor: "pointer" }}
                                title="Sélectionner pour comparer"
                              />
                            </td>
                            <td>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(78,142,247,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4e8ef7" }}>
                                  {c.company_name.slice(0, 1).toUpperCase()}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{c.company_name}</span>
                              </span>
                            </td>
                            <td className="td-muted">{c.total_analyses}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 50, height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${c.avg_score}%`, background: scoreColor(c.avg_score), borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(c.avg_score) }}>{c.avg_score}</span>
                              </div>
                            </td>
                            <td>
                              <span style={{ padding: "2px 10px", borderRadius: 100, background: c.unreviewed_high_risk_count > 0 ? "rgba(224,82,82,0.12)" : "rgba(46,200,140,0.12)", color: c.unreviewed_high_risk_count > 0 ? "#e05252" : "#2ec88c", fontWeight: 600, fontSize: 12 }}>
                                {c.unreviewed_high_risk_count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>

              {/* ═══ BRAND SYSTEM COMPARISON ═══ */}
              {showCompare && compareEntities.length >= 2 && (
                <ComparisonPanel
                  title="Comparaison des marques"
                  subtitle="Tête-à-tête : score, volume, conformité, progression, itérations et risque"
                  accentColor="#4e8ef7"
                  entities={compareEntities}
                  metrics={compareMetrics}
                  onRemove={key => toggleCompare(Number(key))}
                  onClose={() => setShowCompare(false)}
                />
              )}

              {/* ═══ MEMBER LEADERBOARD ═══ */}
              {/* Member activity & performance — who submits the most, and at what quality */}
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
                  Activité &amp; performance par membre
                  <InfoTip text="Membres les plus actifs et leur score de clarté moyen, toutes organisations confondues. Permet de repérer les champions et les membres ayant besoin de formation." />
                </p>
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>
                  Membres les plus actifs et leur score moyen — repère champions et besoins de formation.
                </p>
                {(data.per_user ?? []).length === 0
                  ? <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Aucune activité enregistrée.</p>
                  : (
                    <table className="doc-table">
                      <thead><tr><th>Membre</th><th>Organisation</th><th>Analyses</th><th>Score moy.</th></tr></thead>
                      <tbody>
                        {data.per_user.slice(0, 8).map(u => (
                          <tr key={u.user}>
                            <td className="td-bold" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.user}</td>
                            <td className="td-muted" style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.company_name}</td>
                            <td className="td-muted">{u.count}</td>
                            <td><span style={{ color: scoreColor(u.avg_score), fontWeight: 700, fontSize: 13 }}>{u.avg_score}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </div>

              {/* ═══ ANALYSIS VOLUME OVER TIME (per brand system) ═══ */}
              <TimelineVolumeChart
                title="Nombre d'analyses par période"
                infoText="Volume d'analyses soumises au fil du temps. Choisissez le pas (jour, semaine, mois, année), filtrez par marque ou restreignez à une plage de dates."
                items={allAnalyses.map(a => ({ analyzed_at: a.analyzed_at, series: a.brand_system_name }))}
                seriesLabel="Toutes les marques"
                accentColor="#4e8ef7"
                barColor="#4e8ef7"
              />

              {/* ═══ API TOKEN CONSUMPTION ═══ */}
              <TokenPanel />

              {/* ═══ TREND + DISTRIBUTION ═══ */}
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14, marginBottom: 16 }}>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
                      Tendance globale des scores
                      <InfoTip text="Évolution chronologique des scores de clarté analyse par analyse. Filtrez par marque ; cliquez sur une barre pour ouvrir l'analyse correspondante." />
                    </p>
                    <BrandFilter value={trendBrand} options={trendBrands} onChange={setTrendBrand} />
                  </div>
                  <MiniChart data={trendData} onBarClick={(id) => nav(`/analysis/${id}`)} />
                </div>
                <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                    Distribution des scores
                    <InfoTip align="right" text="Répartition des analyses par tranche de score : Critique (0-25), Faible (25-50), Acceptable (50-75) et Conforme (75-100)." />
                  </p>
                  <DonutChart dist={data.score_distribution} total={data.total_analyses} />
                </div>
              </div>

              {/* ═══ UNREVIEWED HIGH RISK ═══ */}
              {(data.unreviewed_high_risk ?? []).length > 0 && (
                <div id="unreviewed-section" style={{ background: "var(--bg2)", border: "1px solid rgba(224,82,82,0.2)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#e05252", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
                      Soumissions à risque élevé non révisées — toutes organisations
                    </p>
                    <BrandFilter value={unreviewedBrand} options={unreviewedBrands} onChange={setUnreviewedBrand} />
                  </div>
                  <table className="doc-table">
                    <thead><tr><th>Date</th><th>Titre</th><th>Auteur</th><th>Score</th></tr></thead>
                    <tbody>
                      {unreviewedData.map(u => (
                        <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => nav(`/analysis/${u.id}`)}>
                          <td className="td-muted">{u.date}</td>
                          <td className="td-bold" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</td>
                          <td className="td-muted">{u.author || "—"}</td>
                          <td><span style={{ padding: "2px 10px", borderRadius: 100, background: "rgba(224,82,82,0.15)", color: "#e05252", fontWeight: 700, fontSize: 13 }}>{u.score}</span></td>
                        </tr>
                      ))}
                      {unreviewedData.length === 0 && (
                        <tr><td colSpan={4} className="td-muted" style={{ padding: "14px 0" }}>Aucune soumission pour cette marque.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
