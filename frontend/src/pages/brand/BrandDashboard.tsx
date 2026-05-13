import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";

const API = "http://127.0.0.1:8000";
const RISK_COLOR: Record<string, string> = { Low: "#2e7d5e", Medium: "#b07d28", High: "#c0392b" };
const scoreColor = (s: number) => s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";

interface Stats { company_name: string; total_analyses: number; avg_score: number | null; brand_system_count: number; user_count: number; risk_distribution: Record<string, number>; }
interface Analysis { id: number; brand_system_name: string; message_title: string; clarity_score: number; narrative_risk: string; channel: string | null; analyzed_at: string | null; analyzed_by: string | null; member_name: string; }
interface Member { email: string; full_name: string; analysis_count: number; }

const NAV = [
  { path: "/brand/dashboard", label: "Dashboard", icon: "◈" },
  { path: "/brand/users", label: "Team", icon: "◎" },
];

/* ── Custom dark dropdown ─────────────────────────────────────── */
function Dropdown({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; avatar?: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 8, cursor: "pointer",
          background: value ? "rgba(46,200,140,0.1)" : "rgba(255,255,255,0.05)",
          border: value ? "1px solid rgba(46,200,140,0.3)" : "1px solid rgba(255,255,255,0.1)",
          color: value ? "#2ec88c" : "rgba(255,255,255,0.6)",
          fontFamily: "inherit", fontSize: 13, whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}>
        {selected?.avatar && (
          <span style={{ width: 20, height: 20, borderRadius: 5, background: "rgba(46,200,140,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2ec88c" }}>
            {selected.avatar}
          </span>
        )}
        {selected ? selected.label : placeholder}
        <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999,
          background: "#131f2e", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, overflow: "hidden", minWidth: 200,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {/* "All" option */}
          <div
            onClick={() => { onChange(""); setOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: value === "" ? "#2ec88c" : "rgba(255,255,255,0.55)", background: value === "" ? "rgba(46,200,140,0.08)" : "transparent", cursor: "pointer", transition: "background 0.12s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={e => (e.currentTarget.style.background = value === "" ? "rgba(46,200,140,0.08)" : "transparent")}>
            <span style={{ fontSize: 14 }}>✦</span>
            {placeholder}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", fontSize: 13, color: value === o.value ? "#2ec88c" : "rgba(255,255,255,0.7)", background: value === o.value ? "rgba(46,200,140,0.08)" : "transparent", cursor: "pointer", transition: "background 0.12s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = value === o.value ? "rgba(46,200,140,0.08)" : "transparent")}>
              {o.avatar && (
                <span style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(46,200,140,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2ec88c", flexShrink: 0 }}>
                  {o.avatar}
                </span>
              )}
              <span>{o.label}</span>
              {value === o.value && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ companyName }: { companyName: string }) {
  const nav = useNavigate();
  const path = window.location.pathname;
  return (
    <aside className="sidebar" style={{ background: "linear-gradient(180deg, #0f1923 0%, #131f2e 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="sidebar-brand" style={{ background: "rgba(46,125,94,0.12)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{companyName || "Brand Admin"}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(46,200,140,0.7)", textTransform: "uppercase", letterSpacing: "1.2px" }}>Brand Admin Panel</div>
      </div>
      <nav className="sidebar-nav" style={{ padding: "16px 10px" }}>
        {NAV.map(n => (
          <a key={n.path} href={n.path}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2, textDecoration: "none", fontSize: 13, fontWeight: 500, color: path === n.path ? "#2ec88c" : "rgba(255,255,255,0.55)", background: path === n.path ? "rgba(46,200,140,0.08)" : "transparent", border: path === n.path ? "1px solid rgba(46,200,140,0.2)" : "1px solid transparent", transition: "all 0.15s" }}
            onClick={e => { e.preventDefault(); nav(n.path); }}>
            <span>{n.icon}</span> {n.label}
          </a>
        ))}
      </nav>
      <button
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        onClick={() => { logout(); window.location.href = "/login"; }}>
        ⎋ Sign Out
      </button>
    </aside>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function BrandDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [memberFilter, setMemberFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const auth = { Authorization: `Bearer ${getToken()}` };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/brand/stats`,    { headers: auth }).then(r => { if (r.status === 401) { logout(); window.location.href = "/login"; } return r.json(); }),
      fetch(`${API}/api/brand/analyses`, { headers: auth }).then(r => { if (r.status === 401) { logout(); window.location.href = "/login"; } return r.json(); }),
      fetch(`${API}/api/brand/members`,  { headers: auth }).then(r => r.json()),
    ])
      .then(([s, a, m]) => {
        if (s && !s.detail) setStats(s);
        setAnalyses(Array.isArray(a) ? a : []);
        setMembers(Array.isArray(m) ? m : []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = analyses.filter(a => {
    if (memberFilter && a.analyzed_by !== memberFilter) return false;
    if (riskFilter   && a.narrative_risk !== riskFilter) return false;
    if (searchQuery  && !a.message_title.toLowerCase().includes(searchQuery.toLowerCase()) &&
                        !a.member_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const memberOptions = members.map(m => ({
    value: m.email,
    label: `${m.full_name} (${m.analysis_count})`,
    avatar: m.full_name.slice(0, 1).toUpperCase(),
  }));

  const riskOptions = [
    { value: "Low",    label: "🟢 Low" },
    { value: "Medium", label: "🟡 Medium" },
    { value: "High",   label: "🔴 High" },
  ];

  const companyName = stats?.company_name || "";

  return (
    <div className="dashboard-root">
      <Sidebar companyName={companyName} />

      <main className="dashboard-main" style={{ background: "#0d1520" }}>
        <div style={{ maxWidth: 960 }}>

          {/* Header + Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Brand Overview</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Communication analytics scoped to your organisation</p>
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4 }}>
              {(["overview", "history"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: tab === t ? "#2ec88c" : "transparent", color: tab === t ? "#0d1520" : "rgba(255,255,255,0.45)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize" }}>
                  {t === "overview" ? "📊 Overview" : "📋 History"}
                </button>
              ))}
            </div>
          </div>

          {loading && <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.3)", padding: "40px 0" }}><div className="spinner" style={{ borderTopColor: "#2ec88c", width: 22, height: 22, borderWidth: 2 }} /> Loading…</div>}
          {error && <p style={{ color: "#c0392b" }}>{error}</p>}

          {/* ── OVERVIEW TAB ── */}
          {!loading && tab === "overview" && stats && (
            <>
              <div className="kpi-grid" style={{ marginBottom: 24 }}>
                {[
                  { label: "Total Analyses", value: stats.total_analyses, color: "#2a5298" },
                  { label: "Avg Score", value: stats.avg_score ? `${stats.avg_score}/100` : "—", color: "#2e7d5e" },
                  { label: "Brand Systems", value: stats.brand_system_count, color: "#7b4fa8" },
                  { label: "Team Members", value: stats.user_count, color: "#2e7d5e" },
                ].map(k => (
                  <div key={k.label} className="kpi-card" style={{ "--kpi-color": k.color } as React.CSSProperties}>
                    <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
                    <p className={`kpi-value${String(k.value).length > 5 ? " kpi-value-sm" : ""}`}>{k.value}</p>
                    <div className="kpi-bar" />
                  </div>
                ))}
              </div>

              {stats.total_analyses > 0 && (
                <div className="result-card" style={{ marginBottom: 20, background: "rgba(255,255,255,0.03)" }}>
                  <p className="result-section-title">Risk Distribution</p>
                  <div className="risk-dist">
                    {(["Low", "Medium", "High"] as const).map(r => {
                      const count = stats.risk_distribution[r] ?? 0;
                      const pct = stats.total_analyses > 0 ? Math.round((count / stats.total_analyses) * 100) : 0;
                      return (
                        <div key={r} className="risk-dist-item">
                          <span className={`risk-badge risk-${r.toLowerCase()}`}>{r}</span>
                          <div className="risk-dist-track"><div className="risk-dist-fill" style={{ width: `${pct}%`, background: RISK_COLOR[r] }} /></div>
                          <span className="risk-dist-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {members.length > 0 && (
                <div className="result-card" style={{ marginBottom: 20, background: "rgba(255,255,255,0.03)" }}>
                  <p className="result-section-title">Team Activity</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {members.map(m => {
                      const pct = stats.total_analyses > 0 ? Math.round((m.analysis_count / stats.total_analyses) * 100) : 0;
                      return (
                        <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(46,200,140,0.15)", border: "1px solid rgba(46,200,140,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#2ec88c", flexShrink: 0 }}>
                            {m.full_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{m.full_name}</span>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 100 }}>{m.analysis_count} analyse{m.analysis_count !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #2ec88c, #1aa870)", borderRadius: 3, transition: "width 0.8s ease" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="result-card" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <p className="result-section-title" style={{ marginBottom: 0 }}>Recent Analyses</p>
                  <button onClick={() => setTab("history")} style={{ fontSize: 12, padding: "5px 14px", background: "rgba(46,200,140,0.08)", border: "1px solid rgba(46,200,140,0.2)", borderRadius: 7, color: "#2ec88c", fontFamily: "inherit", cursor: "pointer" }}>View all →</button>
                </div>
                {analyses.length === 0 ? (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>No analyses yet.</p>
                ) : (
                  <table className="doc-table">
                    <thead><tr><th>Date</th><th>Title</th><th>Analysed By</th><th>Score</th><th>Risk</th></tr></thead>
                    <tbody>
                      {analyses.slice(0, 5).map(r => (
                        <tr key={r.id}>
                          <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{r.analyzed_at?.slice(0, 10)}</td>
                          <td className="td-bold" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message_title}</td>
                          <td>
                            {r.member_name !== "—" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(46,200,140,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#2ec88c" }}>{r.member_name.slice(0, 1).toUpperCase()}</span>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{r.member_name}</span>
                              </span>
                            ) : <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>—</span>}
                          </td>
                          <td><span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 100, background: `${scoreColor(r.clarity_score)}22`, color: scoreColor(r.clarity_score), fontWeight: 700, fontSize: 13 }}>{r.clarity_score}</span></td>
                          <td><span className={`risk-badge risk-${r.narrative_risk.toLowerCase()}`}>{r.narrative_risk}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {!loading && tab === "history" && (
            <>
              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="🔍  Search title or member…"
                  style={{ flex: 1, minWidth: 180, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.8)", fontFamily: "inherit", fontSize: 13, padding: "8px 14px", outline: "none" }}
                />

                <Dropdown
                  value={memberFilter}
                  onChange={setMemberFilter}
                  options={memberOptions}
                  placeholder="👤 All Members"
                />

                <Dropdown
                  value={riskFilter}
                  onChange={setRiskFilter}
                  options={riskOptions}
                  placeholder="⚡ All Risks"
                />

                {(memberFilter || riskFilter || searchQuery) && (
                  <button onClick={() => { setMemberFilter(""); setRiskFilter(""); setSearchQuery(""); }}
                    style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", color: "#c0392b", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                    ✕ Clear
                  </button>
                )}

                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Table */}
              <div className="result-card" style={{ background: "rgba(255,255,255,0.03)" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>No analyses match your filters.</p>
                    <button onClick={() => { setMemberFilter(""); setRiskFilter(""); setSearchQuery(""); }}
                      style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Title</th><th>Brand System</th>
                        <th style={{ minWidth: 140 }}>Analysed By</th>
                        <th>Score</th><th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <tr key={r.id}>
                          <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{r.analyzed_at?.slice(0, 10) ?? "—"}</td>
                          <td className="td-bold" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.message_title}</td>
                          <td className="td-muted">{r.brand_system_name}</td>
                          <td>
                            {r.member_name !== "—" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                                onClick={() => setMemberFilter(r.analyzed_by || "")}>
                                <span style={{ width: 26, height: 26, borderRadius: 7, background: memberFilter === r.analyzed_by ? "rgba(46,200,140,0.3)" : "rgba(46,200,140,0.12)", border: `1px solid ${memberFilter === r.analyzed_by ? "rgba(46,200,140,0.6)" : "rgba(46,200,140,0.2)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2ec88c", flexShrink: 0, transition: "all 0.15s" }}>
                                  {r.member_name.slice(0, 1).toUpperCase()}
                                </span>
                                <span style={{ fontSize: 13, color: memberFilter === r.analyzed_by ? "#2ec88c" : "rgba(255,255,255,0.7)", fontWeight: memberFilter === r.analyzed_by ? 600 : 400 }}>
                                  {r.member_name}
                                </span>
                              </span>
                            ) : <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>—</span>}
                          </td>
                          <td>
                            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 100, background: `${scoreColor(r.clarity_score)}22`, color: scoreColor(r.clarity_score), fontWeight: 700, fontSize: 13 }}>
                              {r.clarity_score}
                            </span>
                          </td>
                          <td><span className={`risk-badge risk-${r.narrative_risk.toLowerCase()}`}>{r.narrative_risk}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
