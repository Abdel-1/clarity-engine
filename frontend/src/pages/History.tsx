import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalyses, getAdminBrandSystems } from "../services/brandSystems";
import type { AdminBrandSystem } from "../services/brandSystems";
import { isAdmin, isBrandAdmin } from "../services/auth";
import AppSidebar from "../components/AppSidebar";
import Select from "../components/Select";

/* ── Types ──────────────────────────────────────────────────────── */
interface AnalysisRow {
  id: number;
  message_title: string;
  brand_system_name: string;
  brand_system_id: number;
  clarity_score: number;
  narrative_risk: "Low" | "Medium" | "High";
  channel: string | null;
  content_type: string | null;
  analyzed_at: string | null;
  analyzed_by: string | null;
  conversation_id: string;
}

/* ── Nav ─────────────────────────────────────────────────────────── */
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

/* ── Lookup constants ────────────────────────────────────────────── */
const CANAUX = ["LinkedIn", "Email", "Newsletter", "Discours", "Communiqué de presse", "Réseaux sociaux", "Site web", "Autre"];
const TYPES  = ["Post Réseaux Sociaux", "Article", "Discours", "Email", "Newsletter", "Communiqué", "Rapport", "Présentation", "Autre"];

const RISK_CLASS = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" } as const;
const RISK_LABEL = { Low: "Faible", Medium: "Modéré", High: "Élevé" } as const;

const scoreColor = (s: number) =>
  s >= 75 ? "var(--success)" : s >= 50 ? "var(--warn)" : "var(--danger)";
const scoreClass = (s: number) =>
  s >= 75 ? "score-green" : s >= 50 ? "score-amber" : "score-red";

/* ── Skeleton row ────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr style={{ animation: "skeletonPulse 1.4s ease-in-out infinite" }}>
      {[96, 240, 130, 130, 110, 110, 80, 80].map((w, i) => (
        <td key={i} style={{ padding: "13px 14px" }}>
          <div style={{ height: 12, width: w, borderRadius: 6, background: "var(--bg3)", opacity: 0.7 }} />
        </td>
      ))}
    </tr>
  );
}

/* ── FilterChip ──────────────────────────────────────────────────── */
function FilterSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <Select
        value={value}
        onChange={onChange}
        placeholder="Tous"
        ariaLabel={label}
        size="md"
        style={{ minWidth: 160 }}
        options={options.map(o => ({ value: o, label: o }))}
      />
    </div>
  );
}

/* ── DateInput ───────────────────────────────────────────────────── */
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
          color: "var(--text)", fontSize: 13, padding: "6px 10px", cursor: "pointer",
        }}
      />
    </div>
  );
}

/* ── Group analyses by the member who ran them, most active first ──── */
function groupByMember(rows: AnalysisRow[]): [string, AnalysisRow[]][] {
  const map = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    const key = r.analyzed_by || "Sans membre";
    (map.get(key) ?? map.set(key, []).get(key)!).push(r);
  }
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
}

/* ── Per-member analysis table (used inside the drilled-in member view) ── */
function MemberAnalysesTable({
  rows, onRowClick, showBrandColumn,
}: {
  rows: AnalysisRow[];
  onRowClick: (row: AnalysisRow) => void;
  showBrandColumn: boolean;
}) {
  return (
    <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: 100 }}>Date</th>
            <th>Titre</th>
            {showBrandColumn && <th style={{ width: 150 }}>Brand System</th>}
            <th style={{ width: 130 }}>Canal</th>
            <th style={{ width: 160 }}>Type</th>
            <th style={{ width: 90 }}>Score</th>
            <th style={{ width: 100 }}>Risque</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id} id={`analysis-${a.id}`} className="table-row-clickable" onClick={() => onRowClick(a)}>
              <td className="td-muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                {a.analyzed_at?.slice(0, 10)}
              </td>
              <td className="td-bold" style={{ maxWidth: 280 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.message_title}
                </div>
              </td>
              {showBrandColumn && (
                <td style={{ fontSize: 12 }}>
                  <span style={{
                    background: "var(--bg3)", padding: "2px 8px",
                    borderRadius: "var(--radius-xs)", color: "var(--text-muted)",
                    display: "inline-block", maxWidth: 140,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.brand_system_name}
                  </span>
                </td>
              )}
              <td style={{ fontSize: 12 }}>
                {a.channel ? (
                  <span style={{
                    background: "var(--accent-dim)", color: "var(--accent)",
                    border: "1px solid var(--accent-border)",
                    padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                  }}>
                    {a.channel}
                  </span>
                ) : (
                  <span style={{ color: "var(--text-dim)" }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {a.content_type || <span style={{ color: "var(--text-dim)" }}>—</span>}
              </td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 40, height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${a.clarity_score}%`,
                      background: scoreColor(a.clarity_score), borderRadius: 2,
                      transition: "width 0.8s ease",
                    }} />
                  </div>
                  <span className={`score-pill ${scoreClass(a.clarity_score)}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    {a.clarity_score}
                  </span>
                </div>
              </td>
              <td>
                <span className={`risk-badge ${RISK_CLASS[a.narrative_risk] ?? "risk-medium"}`} style={{ fontSize: 11 }}>
                  {RISK_LABEL[a.narrative_risk] ?? a.narrative_risk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Member avatar with a score-health ring + top-contributor trophy ──── */
function MemberAvatar({ member, avgScore, size, isTop }: { member: string; avgScore: number; size: number; isTop: boolean }) {
  return (
    <span style={{
      position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${(member.charCodeAt(0) * 37) % 360}, 55%, 45%)`,
      color: "#fff", fontSize: size * 0.4, fontWeight: 700,
      boxShadow: `0 0 0 2px var(--bg2), 0 0 0 4px ${scoreColor(avgScore)}`,
    }}>
      {member.slice(0, 1).toUpperCase()}
      {isTop && (
        <span title="Meilleure contribution de l'équipe" style={{
          position: "absolute", top: -8, right: -8, fontSize: 13,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
        }}>
          🏆
        </span>
      )}
    </span>
  );
}

/* ── Clickable member card — the entry point into that member's history ── */
function MemberCard({
  member, rows, rank, totalGroups, onClick,
}: {
  member: string;
  rows: AnalysisRow[];
  rank: number;
  totalGroups: number;
  onClick: () => void;
}) {
  const avgScore = Math.round(rows.reduce((s, r) => s + r.clarity_score, 0) / rows.length);
  const isTop = rank === 1 && totalGroups > 1;

  /* Risk mix — a tiny stacked bar instead of just a number */
  const riskCounts = rows.reduce((acc, r) => {
    acc[r.narrative_risk] = (acc[r.narrative_risk] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const riskPct = (k: string) => ((riskCounts[k] ?? 0) / rows.length) * 100;

  return (
    <div className="result-card"
      style={{ padding: 20, cursor: "pointer", transition: "transform 0.2s" }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "none"}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <MemberAvatar member={member} avgScore={avgScore} size={40} isTop={isTop} />
        <div style={{ minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: 15, color: "var(--text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {member}
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {rows.length} analyse{rows.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: scoreColor(avgScore), lineHeight: 1 }}>{avgScore}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Score moyen
          </div>
        </div>
        <div
          title={`Faible ${riskCounts.Low ?? 0} · Modéré ${riskCounts.Medium ?? 0} · Élevé ${riskCounts.High ?? 0}`}
          style={{ display: "flex", width: 84, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bg3)" }}
        >
          <div style={{ width: `${riskPct("Low")}%`, background: "var(--success)" }} />
          <div style={{ width: `${riskPct("Medium")}%`, background: "var(--warn)" }} />
          <div style={{ width: `${riskPct("High")}%`, background: "var(--danger)" }} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {(riskCounts.High ?? 0) > 0 ? `${riskCounts.High} à risque élevé` : "Aucun risque élevé"}
        </span>
        <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>Voir les analyses →</span>
      </div>
    </div>
  );
}

/* ── Drilled-in view: one member's full analysis history + a way back ──── */
function MemberAnalysesView({
  member, rows, onBack, onRowClick, showBrandColumn,
}: {
  member: string;
  rows: AnalysisRow[];
  onBack: () => void;
  onRowClick: (row: AnalysisRow) => void;
  showBrandColumn: boolean;
}) {
  const avgScore = Math.round(rows.reduce((s, r) => s + r.clarity_score, 0) / rows.length);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={onBack}>
          ← Tous les membres
        </button>
        <span style={{ color: "var(--text-dim)", fontSize: "1rem" }}>/</span>
        <MemberAvatar member={member} avgScore={avgScore} size={28} isTop={false} />
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{member}</span>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          · {rows.length} analyse{rows.length > 1 ? "s" : ""} · score moyen {avgScore}
        </span>
      </div>
      <MemberAnalysesTable rows={rows} onRowClick={onRowClick} showBrandColumn={showBrandColumn} />
    </>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function History() {
  const nav = useNavigate();

  /* Role */
  const admin      = isAdmin();
  const brandAdmin = isBrandAdmin();
  const NAV        = admin ? NAV_ADMIN : brandAdmin ? NAV_BRAND : NAV_MEMBRE;
  const role       = admin ? "admin" as const : brandAdmin ? "brand_admin" as const : "membre" as const;
  const accentColor = admin ? "#fdd335" : brandAdmin ? "#2ec88c" : "#4e8ef7";

  /* Admin picks a brand system first; its history is then shown grouped by member */
  const [brandSystemsList, setBrandSystemsList] = useState<AdminBrandSystem[]>([]);
  const [selectedBrand,    setSelectedBrand]    = useState<AdminBrandSystem | null>(null);

  /* Drilled-into member (admin post-selection & brand admin grouped views) */
  const [viewMember, setViewMember] = useState<string | null>(null);

  /* Flat analysis list */
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading,  setLoading]  = useState(true);

  /* Server-side scope (admin → brand_system_id once a brand is selected) */
  const [scope, setScope] = useState<Record<string, string>>({});

  /* Filters */
  const [search,       setSearch]       = useState("");
  const [filterBrand,  setFilterBrand]  = useState("");
  const [filterCanal,  setFilterCanal]  = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [filterRisk,   setFilterRisk]   = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");

  const hasFilters = !!(filterBrand || filterCanal || filterType || filterRisk || filterMember || dateFrom || dateTo || search);

  /* Admin must pick a brand system first; brand admin & members go straight to the list */
  useEffect(() => {
    if (admin) {
      getAdminBrandSystems().then(setBrandSystemsList).finally(() => setLoading(false));
    }
  }, []);

  /* Are we showing the analyses list (vs. the admin's brand-system picker)?
     Brand admins and members always see the list; only an admin must pick a
     brand system first. */
  const viewingList = !admin || !!selectedBrand;

  /* History is grouped by member for an admin viewing a brand system, and
     always for a brand admin (their team's history). */
  const showGrouped = (admin && !!selectedBrand) || brandAdmin;

  /* Hide the redundant Brand System column/filter once admin has scoped to one brand */
  const showBrandColumn = !selectedBrand;

  /* Load (and reload) the analyses whenever the scope or a server-side filter
     changes — runs for every role and preserves the selected scope. */
  useEffect(() => {
    if (!viewingList) return;
    setLoading(true);
    const filters: Record<string, string> = { ...scope };
    if (filterCanal) filters.channel      = filterCanal;
    if (filterType)  filters.content_type = filterType;
    if (filterRisk)  filters.risk         = filterRisk;
    if (dateFrom)    filters.date_from    = dateFrom;
    if (dateTo)      filters.date_to      = dateTo;
    getAnalyses(filters)
      .then(data => setAnalyses(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [viewingList, scope, filterCanal, filterType, filterRisk, dateFrom, dateTo]);

  /* Admin selects a brand system → scope by brand_system_id */
  function handleSelectBrand(bs: AdminBrandSystem) {
    setSelectedBrand(bs);
    setScope({ brand_system_id: String(bs.id) });
    setSearch(""); setFilterMember(""); setFilterBrand(""); setViewMember(null);
  }

  function handleBack() {
    setSelectedBrand(null);
    setScope({});
    setAnalyses([]);
    setSearch(""); setFilterMember(""); setFilterBrand(""); setViewMember(null);
  }

  function clearFilters() {
    setFilterBrand(""); setFilterCanal(""); setFilterType(""); setFilterRisk(""); setFilterMember("");
    setDateFrom(""); setDateTo(""); setSearch("");
  }

  /* Distinct brand systems & members present in the loaded analyses (filter options) */
  const brandOptions = Array.from(
    new Set(analyses.map(a => a.brand_system_name).filter((n): n is string => !!n))
  ).sort();
  const memberOptions = Array.from(
    new Set(analyses.map(a => a.analyzed_by).filter((n): n is string => !!n))
  ).sort();

  /* Client-side brand + member filters and search on title/brand */
  const filtered = analyses.filter(a => {
    if (filterBrand && a.brand_system_name !== filterBrand) return false;
    if (filterMember && a.analyzed_by !== filterMember) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (a.message_title || "").toLowerCase().includes(q) ||
      (a.brand_system_name || "").toLowerCase().includes(q)
    );
  });

  /* Show brand/member picker for admin or brand_admin before selection */
  const showPicker = !viewingList;

  /* Pre-grouped once so rank/total can be handed to each section */
  const memberGroups = showGrouped ? groupByMember(filtered) : [];

  return (
    <div className="dashboard-root">
      <AppSidebar role={role} navItems={NAV} />

      <main className="dashboard-main">
        <div className="page-content">

          {/* ── Header ─────────────────────────────────────────────── */}
          <header className="dash-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h1 className="dash-title" style={{ margin: 0 }}>Historique</h1>
                {selectedBrand && (
                  <>
                    <span style={{ color: "var(--text-dim)", fontSize: "1.2rem" }}>/</span>
                    <span style={{ color: accentColor, fontWeight: 600 }}>
                      {selectedBrand.brand_name}
                    </span>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={handleBack}>
                      ✕ Changer
                    </button>
                  </>
                )}
              </div>
              <p className="dash-subtitle">
                {showPicker
                  ? "Sélectionnez un brand system pour voir son historique"
                  : admin
                    ? "Historique catégorisé par membre — filtrez par canal, date, type ou risque"
                    : brandAdmin
                      ? "Historique de votre équipe, catégorisé par membre"
                      : "Toutes les analyses — filtrez par date, canal ou type de contenu"}
              </p>
            </div>
            {!brandAdmin && (
              <a href="/analyze" className="btn-primary"
                onClick={e => { e.preventDefault(); nav("/analyze"); }}>
                + Nouvelle analyse
              </a>
            )}
          </header>

          {/* ── Brand system picker (admin only) ───────────────────── */}
          {showPicker ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginTop: 10 }}>
              {brandSystemsList.map(bs => (
                <div key={bs.id} className="result-card"
                  style={{ padding: 20, cursor: "pointer", transition: "transform 0.2s" }}
                  onClick={() => handleSelectBrand(bs)}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 40, height: 40, borderRadius: "50%",
                      background: `hsl(${(bs.brand_name.charCodeAt(0) * 37) % 360}, 58%, 42%)`,
                      color: "#fff", fontSize: 16, fontWeight: 700,
                    }}>
                      {bs.brand_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>{bs.brand_name}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                        {bs.company_name}{bs.sector ? ` · ${bs.sector}` : ""}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{bs.analysis_count} analyses</span>
                    <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>Voir l'historique →</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── Filter bar ────────────────────────────────────────── */}
              <div className="result-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                  {/* Search (hidden in the admin view) */}
                  {!admin && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Recherche
                      </label>
                      <input
                        className="filter-input"
                        placeholder="Titre ou Brand System…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ borderRadius: "var(--radius-xs)", fontSize: 13, padding: "6px 10px" }}
                      />
                    </div>
                  )}

                  {brandOptions.length > 1 && showBrandColumn && (
                    <FilterSelect label="Brand System" value={filterBrand} options={brandOptions} onChange={setFilterBrand} />
                  )}
                  <FilterSelect label="Canal"            value={filterCanal} options={CANAUX} onChange={setFilterCanal} />
                  <FilterSelect label="Type de contenu"  value={filterType}  options={TYPES}  onChange={setFilterType} />
                  <FilterSelect label="Risque"           value={filterRisk}
                    options={["Low", "Medium", "High"]}
                    onChange={setFilterRisk} />
                  {/* Membre filter hidden once history is already grouped by member */}
                  {!showGrouped && memberOptions.length > 0 && (
                    <FilterSelect label="Membre" value={filterMember} options={memberOptions} onChange={setFilterMember} />
                  )}
                  <DateInput label="Du"    value={dateFrom} onChange={setDateFrom} />
                  <DateInput label="Au"    value={dateTo}   onChange={setDateTo} />

                  {hasFilters && (
                    <button onClick={clearFilters}
                      style={{
                        alignSelf: "flex-end", background: "transparent",
                        border: "1px solid var(--border)", borderRadius: "var(--radius-xs)",
                        color: "var(--text-dim)", fontSize: 12, padding: "6px 14px",
                        cursor: "pointer", whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-dim)")}>
                      ✕ Effacer les filtres
                    </button>
                  )}
                </div>

                {/* Active filter chips */}
                {hasFilters && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                    {filterBrand && (
                      <span style={chipStyle}>{filterBrand} <button style={chipXStyle} onClick={() => setFilterBrand("")}>×</button></span>
                    )}
                    {filterCanal && (
                      <span style={chipStyle}>{filterCanal} <button style={chipXStyle} onClick={() => setFilterCanal("")}>×</button></span>
                    )}
                    {filterType && (
                      <span style={chipStyle}>{filterType} <button style={chipXStyle} onClick={() => setFilterType("")}>×</button></span>
                    )}
                    {filterRisk && (
                      <span style={chipStyle}>{filterRisk} <button style={chipXStyle} onClick={() => setFilterRisk("")}>×</button></span>
                    )}
                    {filterMember && (
                      <span style={chipStyle}>{filterMember} <button style={chipXStyle} onClick={() => setFilterMember("")}>×</button></span>
                    )}
                    {dateFrom && (
                      <span style={chipStyle}>Du {dateFrom} <button style={chipXStyle} onClick={() => setDateFrom("")}>×</button></span>
                    )}
                    {dateTo && (
                      <span style={chipStyle}>Au {dateTo} <button style={chipXStyle} onClick={() => setDateTo("")}>×</button></span>
                    )}
                    {search && (
                      <span style={chipStyle}>"{search}" <button style={chipXStyle} onClick={() => setSearch("")}>×</button></span>
                    )}
                  </div>
                )}
              </div>

              {/* ── History grouped by member (admin post-selection & brand admin) ── */}
              {showGrouped ? (
                loading ? (
                  <div className="result-card" style={{ padding: 24 }}>
                    <div style={{ height: 12, width: 200, borderRadius: 6, background: "var(--bg3)", opacity: 0.7, animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="result-card" style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: "2rem" }}>▤</span>
                      <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
                        {hasFilters ? "Aucune analyse ne correspond aux filtres." : "Aucune analyse pour le moment."}
                      </p>
                      {hasFilters && (
                        <button onClick={clearFilters} className="btn-ghost" style={{ fontSize: 12 }}>Effacer les filtres</button>
                      )}
                    </div>
                  </div>
                ) : viewMember ? (
                  <MemberAnalysesView
                    member={viewMember}
                    rows={memberGroups.find(([m]) => m === viewMember)?.[1] ?? []}
                    onBack={() => setViewMember(null)}
                    onRowClick={a => nav(`/history/${a.conversation_id}`)}
                    showBrandColumn={showBrandColumn}
                  />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
                    {memberGroups.map(([member, rows], idx) => (
                      <MemberCard
                        key={member}
                        member={member}
                        rows={rows}
                        rank={idx + 1}
                        totalGroups={memberGroups.length}
                        onClick={() => setViewMember(member)}
                      />
                    ))}
                  </div>
                )
              ) : (
              <>
              {/* ── Table ─────────────────────────────────────────────── */}
              <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Date</th>
                      <th>Titre</th>
                      {showBrandColumn && <th style={{ width: 150 }}>Brand System</th>}
                      <th style={{ width: 150 }}>Membre</th>
                      <th style={{ width: 130 }}>Canal</th>
                      <th style={{ width: 160 }}>Type</th>
                      <th style={{ width: 90 }}>Score</th>
                      <th style={{ width: 100 }}>Risque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "48px 24px" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: "2rem" }}>▤</span>
                            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
                              {hasFilters ? "Aucune analyse ne correspond aux filtres." : "Aucune analyse pour le moment."}
                            </p>
                            {hasFilters ? (
                              <button onClick={clearFilters} className="btn-ghost" style={{ fontSize: 12 }}>Effacer les filtres</button>
                            ) : (
                              <a href="/analyze" className="btn-primary"
                                onClick={e => { e.preventDefault(); nav("/analyze"); }}>
                                Lancer votre première analyse →
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.map(a => (
                        <tr
                          key={a.id}
                          id={`analysis-${a.id}`}
                          className="table-row-clickable"
                          onClick={() => nav(`/history/${a.conversation_id}`)}
                        >
                          {/* Date */}
                          <td className="td-muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                            {a.analyzed_at?.slice(0, 10)}
                          </td>

                          {/* Title */}
                          <td className="td-bold" style={{ maxWidth: 280 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {a.message_title}
                            </div>
                          </td>

                          {/* Brand System */}
                          {showBrandColumn && (
                            <td style={{ fontSize: 12 }}>
                              <span style={{
                                background: "var(--bg3)", padding: "2px 8px",
                                borderRadius: "var(--radius-xs)", color: "var(--text-muted)",
                                display: "inline-block", maxWidth: 140,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {a.brand_system_name}
                              </span>
                            </td>
                          )}

                          {/* Membre */}
                          <td style={{ fontSize: 12 }}>
                            {a.analyzed_by ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 140 }}>
                                <span style={{
                                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                                  background: `hsl(${(a.analyzed_by.charCodeAt(0) * 37) % 360}, 55%, 45%)`,
                                  color: "#fff", fontSize: 10, fontWeight: 700,
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  {a.analyzed_by.slice(0, 1).toUpperCase()}
                                </span>
                                <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {a.analyzed_by}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-dim)" }}>—</span>
                            )}
                          </td>

                          {/* Canal */}
                          <td style={{ fontSize: 12 }}>
                            {a.channel ? (
                              <span style={{
                                background: "var(--accent-dim)", color: "var(--accent)",
                                border: "1px solid var(--accent-border)",
                                padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                              }}>
                                {a.channel}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-dim)" }}>—</span>
                            )}
                          </td>

                          {/* Type de contenu */}
                          <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {a.content_type || <span style={{ color: "var(--text-dim)" }}>—</span>}
                          </td>

                          {/* Score */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <div style={{ width: 40, height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", width: `${a.clarity_score}%`,
                                  background: scoreColor(a.clarity_score), borderRadius: 2,
                                  transition: "width 0.8s ease",
                                }} />
                              </div>
                              <span className={`score-pill ${scoreClass(a.clarity_score)}`}
                                style={{ fontSize: 13, fontWeight: 600 }}>
                                {a.clarity_score}
                              </span>
                            </div>
                          </td>

                          {/* Risque */}
                          <td>
                            <span className={`risk-badge ${RISK_CLASS[a.narrative_risk] ?? "risk-medium"}`}
                              style={{ fontSize: 11 }}>
                              {RISK_LABEL[a.narrative_risk] ?? a.narrative_risk}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Count */}
              {!loading && filtered.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "right" }}>
                  {filtered.length} analyse{filtered.length > 1 ? "s" : ""}
                </p>
              )}
              </>
              )}

              {/* Count (grouped view) — the drilled-in view shows its own count in the breadcrumb */}
              {showGrouped && !viewMember && !loading && filtered.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "right" }}>
                  {memberGroups.length} membre{memberGroups.length > 1 ? "s" : ""} · {filtered.length} analyse{filtered.length > 1 ? "s" : ""}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

/* ── Chip styles ─────────────────────────────────────────────────── */
const chipStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
  color: "var(--accent)", borderRadius: 100, padding: "2px 10px",
  fontSize: 11, fontWeight: 600,
};
const chipXStyle: React.CSSProperties = {
  background: "none", border: "none", color: "inherit",
  cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0,
};
