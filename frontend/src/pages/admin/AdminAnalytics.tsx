import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import logoSvg from "../../assets/logo.svg";

const API = "http://127.0.0.1:8000";

const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",   icon: "◈" },
  { path: "/admin/analytics", label: "Analytics", icon: "✦" },
];

interface PerClient { client_id: number; company_name: string; total: number; avg_score: number | null; }
interface GlobalStats {
  total_analyses:     number;
  avg_score:          number | null;
  client_count:       number;
  brand_system_count: number;
  risk_distribution:  Record<string, number>;
  per_client:         PerClient[];
}
interface AnalysisRow {
  id: number;
  client_id: number;
  brand_system_id: number;
  message_title: string;
  clarity_score: number;
  narrative_risk: string;
  analyzed_at: string;
}

const scoreColor = (s: number | null) =>
  s === null ? "var(--text-dim)" : s >= 75 ? "var(--success)" : s >= 50 ? "var(--warn)" : "var(--danger)";
const scoreClass = (s: number | null) =>
  s === null ? "" : s >= 75 ? "score-green" : s >= 50 ? "score-amber" : "score-red";
const riskCol: Record<string, string> = { Low: "#2e7d5e", Medium: "#b07d28", High: "#c0392b" };
const riskBg:  Record<string, string> = { Low: "rgba(46,125,94,0.1)", Medium: "rgba(176,125,40,0.1)", High: "rgba(192,57,43,0.1)" };

function Sidebar({ nav }: { nav: ReturnType<typeof useNavigate> }) {
  return (
    <aside className="sidebar" style={{ background: "linear-gradient(180deg, #0f1923 0%, #131f2e 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="sidebar-brand" style={{ background: "rgba(42,82,152,0.15)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "18px 16px" }}>
        <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%", filter: "brightness(1.8)" }} />
        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "rgba(253,211,53,0.8)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
          Admin Panel
        </div>
      </div>
      <nav className="sidebar-nav" style={{ padding: "16px 10px" }}>
        {NAV_ADMIN.map(n => (
          <a key={n.path} href={n.path} id={`nav-${n.label.toLowerCase()}`}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, marginBottom: 2,
              textDecoration: "none", fontSize: 13, fontWeight: 500,
              color: window.location.pathname === n.path ? "#fdd335" : "rgba(255,255,255,0.55)",
              background: window.location.pathname === n.path ? "rgba(253,211,53,0.08)" : "transparent",
              border: window.location.pathname === n.path ? "1px solid rgba(253,211,53,0.15)" : "1px solid transparent",
              transition: "all 0.15s",
            }}
            onClick={e => { e.preventDefault(); nav(n.path); }}>
            <span style={{ fontSize: "1rem" }}>{n.icon}</span> {n.label}
          </a>
        ))}
      </nav>
      <button style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", fontFamily: "inherit", fontSize: 13, cursor: "pointer", transition: "color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        onClick={() => { logout(); window.location.href = "/login"; }}>
        ⎋ Sign Out
      </button>
    </aside>
  );
}

export default function AdminAnalytics() {
  const nav = useNavigate();
  const [stats,     setStats]     = useState<GlobalStats | null>(null);
  const [analyses,  setAnalyses]  = useState<AnalysisRow[]>([]);
  const [clients,   setClients]   = useState<Record<number, string>>({});
  const [tab,       setTab]       = useState<"overview" | "history">("overview");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const tok = { Authorization: `Bearer ${getToken()}` };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/stats`,    { headers: tok }).then(r => { if (r.status === 401) { logout(); window.location.href = "/login"; } return r.json(); }),
      fetch(`${API}/api/admin/analyses`, { headers: tok }).then(r => { if (r.status === 401) { logout(); window.location.href = "/login"; } return r.json(); }),
      fetch(`${API}/api/admin/clients`,  { headers: tok }).then(r => { if (r.status === 401) { logout(); window.location.href = "/login"; } return r.json(); }),
    ])
      .then(([s, a, c]) => {
        setStats(s && !s.detail ? s : null);
        setAnalyses(Array.isArray(a) ? a : []);
        const map: Record<number, string> = {};
        if (Array.isArray(c)) c.forEach((cl: any) => { map[cl.id] = cl.company_name; });
        setClients(map);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredAnalyses = analyses.filter(a => {
    if (riskFilter && a.narrative_risk !== riskFilter) return false;
    if (clientFilter && String(a.client_id) !== clientFilter) return false;
    return true;
  });

  return (
    <div className="dashboard-root">
      <Sidebar nav={nav} />

      <main className="dashboard-main" style={{ background: "#0d1520" }}>
        {/* ── Header ── */}
        <div style={{ maxWidth: 1000, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: "#fff", marginBottom: 4 }}>
                Global Analytics
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                Real-time intelligence across all client accounts
              </p>
            </div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4 }}>
              {(["overview", "history"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "7px 18px", borderRadius: 7, border: "none",
                  background: tab === t ? "#2a5298" : "transparent",
                  color: tab === t ? "#fff" : "rgba(255,255,255,0.4)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  textTransform: "capitalize", transition: "all 0.15s",
                }}>
                  {t === "overview" ? "📊 Overview" : "📋 History"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "rgba(255,255,255,0.3)" }}>
            <div className="spinner" style={{ borderTopColor: "#2a5298", width: 28, height: 28, borderWidth: 3, marginRight: 12 }} />
            Loading analytics…
          </div>
        )}
        {error && <p style={{ color: "#c0392b", padding: "24px 0" }}>{error}</p>}

        {!loading && stats && (
          <div style={{ maxWidth: 1000 }}>

            {/* ════ OVERVIEW TAB ════ */}
            {tab === "overview" && (
              <>
                {/* KPI Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                  {[
                    { label: "Total Analyses",    value: stats.total_analyses,       icon: "🔍", color: "#2a5298",  sub: "platform-wide" },
                    { label: "Avg Clarity Score", value: stats.avg_score !== null ? `${stats.avg_score}` : "—", icon: "✦", color: "#2e7d5e", sub: "out of 100" },
                    { label: "Active Clients",    value: stats.client_count,          icon: "◈",  color: "#7c3aed", sub: "organisations" },
                    { label: "Brand Systems",     value: stats.brand_system_count,    icon: "🏷",  color: "#b07d28", sub: "configured" },
                  ].map(k => (
                    <div key={k.label} style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, padding: "20px 18px 16px", position: "relative", overflow: "hidden",
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color, opacity: 0.7 }} />
                      <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{k.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: 34, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{k.value}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  {/* Risk Distribution */}
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 18 }}>
                      Risk Distribution
                    </div>
                    {stats.total_analyses === 0 ? (
                      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No analyses yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {(["Low", "Medium", "High"] as const).map(r => {
                          const count = stats.risk_distribution[r] ?? 0;
                          const pct = stats.total_analyses > 0 ? Math.round((count / stats.total_analyses) * 100) : 0;
                          return (
                            <div key={r}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: riskCol[r] }}>{r} Risk</span>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{count} · {pct}%</span>
                              </div>
                              <div style={{ height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: riskCol[r], borderRadius: 4, transition: "width 1s ease", opacity: 0.85 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Top Clients by Score */}
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                      Clients by Score
                    </div>
                    {stats.per_client.length === 0 ? (
                      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No client data yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[...stats.per_client].sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0)).slice(0, 5).map(c => (
                          <div key={c.client_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 8,
                              background: "rgba(42,82,152,0.3)", border: "1px solid rgba(42,82,152,0.4)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: "#7ba7e8", flexShrink: 0,
                            }}>
                              {c.company_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>{c.company_name}</div>
                              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                                <div style={{ width: `${c.avg_score ?? 0}%`, height: "100%", background: scoreColor(c.avg_score), borderRadius: 2, transition: "width 0.8s ease" }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(c.avg_score), minWidth: 36, textAlign: "right" }}>
                              {c.avg_score ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-Client Full Table */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16 }}>
                    Per-Client Breakdown
                  </div>
                  {stats.per_client.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No clients yet.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {["Client", "Analyses", "Avg Score", "Share", "Top Risk"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...stats.per_client].sort((a, b) => b.total - a.total).map((c, i) => {
                          const pct = stats.total_analyses > 0 ? Math.round((c.total / stats.total_analyses) * 100) : 0;
                          const clientAnalyses = analyses.filter(a => a.client_id === c.client_id);
                          const riskCount = { Low: 0, Medium: 0, High: 0 };
                          clientAnalyses.forEach(a => { riskCount[a.narrative_risk as keyof typeof riskCount]++; });
                          const topRisk = Object.entries(riskCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
                          return (
                            <tr key={c.client_id} id={`analytics-row-${c.client_id}`}
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.12s", cursor: "pointer" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                              <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `hsl(${(i * 67) % 360}, 40%, 25%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: `hsl(${(i * 67) % 360}, 70%, 75%)` }}>
                                    {c.company_name.slice(0, 1).toUpperCase()}
                                  </div>
                                  {c.company_name}
                                </div>
                              </td>
                              <td style={{ padding: "11px 12px", color: "rgba(255,255,255,0.5)" }}>{c.total}</td>
                              <td style={{ padding: "11px 12px" }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: scoreColor(c.avg_score) }}>{c.avg_score ?? "—"}</span>
                                {c.avg_score !== null && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 2 }}>/100</span>}
                              </td>
                              <td style={{ padding: "11px 12px", minWidth: 140 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: "#2a5298", transition: "width 0.8s ease" }} />
                                  </div>
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", minWidth: 30 }}>{pct}%</span>
                                </div>
                              </td>
                              <td style={{ padding: "11px 12px" }}>
                                {topRisk !== "—" && (
                                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: riskBg[topRisk], color: riskCol[topRisk], border: `1px solid ${riskCol[topRisk]}30` }}>
                                    {topRisk}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* ════ HISTORY TAB ════ */}
            {tab === "history" && (
              <>
                {/* Filters */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "inherit",
                    fontSize: 12, padding: "7px 12px", outline: "none", cursor: "pointer",
                  }}>
                    <option value="">All Risks</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                  <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "rgba(255,255,255,0.6)", fontFamily: "inherit",
                    fontSize: 12, padding: "7px 12px", outline: "none", cursor: "pointer",
                  }}>
                    <option value="">All Clients</option>
                    {Object.entries(clients).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", marginLeft: "auto" }}>
                    {filteredAnalyses.length} result{filteredAnalyses.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Table */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
                  {filteredAnalyses.length === 0 ? (
                    <div style={{ padding: "48px 24px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                      No analyses match your filters.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {["Date", "Title", "Client", "Score", "Risk"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 16px", color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAnalyses.map(a => (
                          <tr key={a.id}
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            onClick={() => nav(`/analysis/${a.id}`)}>
                            <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.3)", fontSize: 11, whiteSpace: "nowrap" }}>
                              {a.analyzed_at?.slice(0, 10) ?? "—"}
                            </td>
                            <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.75)", fontWeight: 500, maxWidth: 280 }}>
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {a.message_title}
                              </div>
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(42,82,152,0.2)", color: "#7ba7e8", fontWeight: 500 }}>
                                {clients[a.client_id] ?? `Client #${a.client_id}`}
                              </span>
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: scoreColor(a.clarity_score) }}>{a.clarity_score}</span>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginLeft: 2 }}>/100</span>
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: riskBg[a.narrative_risk] ?? "transparent", color: riskCol[a.narrative_risk] ?? "white", border: `1px solid ${riskCol[a.narrative_risk] ?? "#fff"}30` }}>
                                {a.narrative_risk}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
