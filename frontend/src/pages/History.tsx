import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalyses } from "../services/brandSystems";
import { logout } from "../services/auth";
import logoSvg from "../assets/logo.svg";

interface Row {
  id: number; message_title: string; brand_system_name: string;
  content_type: string; channel: string; clarity_score: number;
  narrative_risk: "Low" | "Medium" | "High"; analyzed_at: string;
}

const NAV_CLIENT = [
  { path: "/",        label: "Dashboard",  icon: "⬡" },
  { path: "/analyze", label: "Analyser",   icon: "✦" },
  { path: "/history", label: "Historique", icon: "◈" },
];

const scoreColor = (s: number) => s >= 75 ? "var(--success)" : s >= 50 ? "var(--warn)" : "var(--danger)";
const scoreClass = (s: number) => s >= 75 ? "score-green" : s >= 50 ? "score-amber" : "score-red";
const RISK_CLASS  = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" } as const;

export default function History() {
  const nav = useNavigate();
  const [rows,     setRows]     = useState<Row[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [risk,     setRisk]     = useState("");
  const [channel,  setChannel]  = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const load = async () => {
    setLoading(true);
    const f: Record<string, string> = {};
    if (risk)     f.risk      = risk;
    if (channel)  f.channel   = channel;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo)   f.date_to   = dateTo;
    const data = await getAnalyses(f);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
        </div>
        <nav className="sidebar-nav">
          <div style={{ marginBottom: 6, padding: "0 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.9px" }}>
            Navigation
          </div>
          {NAV_CLIENT.map(n => (
            <a key={n.path} href={n.path}
              className={`nav-item${n.path === "/history" ? " active" : ""}`}
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span style={{ fontSize: "0.9rem" }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 960 }}>
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Analysis History</h1>
              <p className="dash-subtitle">All brand governance evaluations for your account</p>
            </div>
            <a href="/analyze" className="btn-primary"
              onClick={e => { e.preventDefault(); nav("/analyze"); }}>
              + Nouvelle analyse
            </a>
          </header>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
            <select className="filter-select" value={risk} onChange={e => setRisk(e.target.value)}>
              <option value="">All Risks</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <input className="filter-input" type="text" placeholder="Channel…"
              value={channel} onChange={e => setChannel(e.target.value)} />
            <input className="filter-input" type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>→</span>
            <input className="filter-input" type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
            <button className="btn-primary" style={{ padding: "7px 16px", fontSize: 13 }} onClick={load}>
              Filter
            </button>
            {(risk || channel || dateFrom || dateTo) && (
              <button className="btn-ghost" style={{ padding: "7px 14px", fontSize: 12 }}
                onClick={() => { setRisk(""); setChannel(""); setDateFrom(""); setDateTo(""); setTimeout(load, 0); }}>
                Clear
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>
              {rows.length} result{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading ? (
            <div className="page-loading"><span className="spinner" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="empty-cta">
              <div style={{ fontSize: "2rem" }}>📋</div>
              <p>No analyses found{(risk || channel || dateFrom || dateTo) ? " for these filters" : " yet"}.</p>
              <a href="/analyze" className="btn-primary"
                onClick={e => { e.preventDefault(); nav("/analyze"); }}>
                Run your first analysis →
              </a>
            </div>
          ) : (
            <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Brand System</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="table-row-clickable"
                      id={`analysis-row-${r.id}`}
                      onClick={() => nav(`/analysis/${r.id}`)}>
                      <td className="td-muted" style={{ whiteSpace: "nowrap" }}>{r.analyzed_at?.slice(0, 10)}</td>
                      <td className="td-bold" style={{ maxWidth: 280 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.message_title}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ background: "var(--bg3)", padding: "2px 8px", borderRadius: 4, color: "var(--text-muted)" }}>
                          {r.brand_system_name}
                        </span>
                      </td>
                      <td className="td-muted" style={{ fontSize: 12 }}>{r.content_type || "—"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={`score-pill ${scoreClass(r.clarity_score)}`}>{r.clarity_score}</span>
                          <div style={{ width: 36, height: 4, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${r.clarity_score}%`, background: scoreColor(r.clarity_score), borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`risk-badge ${RISK_CLASS[r.narrative_risk]}`}>{r.narrative_risk}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
