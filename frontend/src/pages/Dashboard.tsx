import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import { getStats, getAnalyses } from "../services/brandSystems";
import logoSvg from "../assets/logo.svg";

interface Stats { total: number; avg_score: number; risk_distribution: Record<string,number>; }
interface Row { id:number; message_title:string; brand_system_name:string; clarity_score:number; narrative_risk:string; analyzed_at:string; }
const RISK_CLASS: Record<string,string> = { Low:"risk-low", Medium:"risk-medium", High:"risk-high" };
const scoreClass = (s: number) => s >= 75 ? "score-green" : s >= 50 ? "score-amber" : "score-red";

const NAV = [
  { path: "/",                    label: "Dashboard" },
  { path: "/analyze",             label: "Analyser" },
  { path: "/brand-system/new",    label: "Brand Systems" },
  { path: "/brand-system/import", label: "Importer un Brand" },
  { path: "/history",             label: "Historique" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const [stats,  setStats]  = useState<Stats|null>(null);
  const [recent, setRecent] = useState<Row[]>([]);
  const [active, setActive] = useState("/");

  useEffect(() => {
    getStats().then(setStats);
    getAnalyses().then(d => setRecent(d.slice(0,5)));
  }, []);

  const go = (path: string) => { setActive(path); nav(path); };

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{height:30, maxWidth:"100%"}} />
        </div>

        <nav className="sidebar-nav">
          <div style={{marginBottom:6, padding:"0 8px", fontSize:10, fontWeight:700, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:"0.9px"}}>
            Navigation
          </div>
          {NAV.map(n => (
            <a key={n.path} href={n.path} id={`nav-${n.label.toLowerCase().replace(" ","_")}`}
              className={`nav-item${active===n.path?" active":""}`}
              onClick={e => { e.preventDefault(); go(n.path); }}>
              {n.label}
            </a>
          ))}
        </nav>

        <button id="logout-btn" className="logout-btn" onClick={() => { logout(); window.location.href="/login"; }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div className="page-content" style={{maxWidth:900}}>
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Brand Governance</h1>
              <p className="dash-subtitle">Clarity Engine · Communication analysis platform</p>
            </div>
            <a href="/analyze" className="btn-primary" onClick={e=>{e.preventDefault();go("/analyze")}}>
              + Nouvelle analyse
            </a>
          </header>

          {/* KPIs */}
          <div className="kpi-grid">
            {[
              {label:"Total Analyses",  value: stats?.total ?? "—",                      color:"#2a5298"},
              {label:"Score Moyen",     value: stats ? `${stats.avg_score}/100` : "—",    color:"#2e7d5e"},
              {label:"Low Risk",        value: stats?.risk_distribution?.Low ?? "—",       color:"#2e7d5e"},
              {label:"High Risk",       value: stats?.risk_distribution?.High ?? "—",      color:"#c0392b"},
            ].map(k => (
              <div key={k.label} className="kpi-card" style={{"--kpi-color":k.color} as React.CSSProperties}>
                <div className="kpi-top">
                  <span className="kpi-label">{k.label}</span>
                </div>
                <p className={`kpi-value${String(k.value).length>5?" kpi-value-sm":""}`}>{k.value}</p>
                <div className="kpi-bar"/>
              </div>
            ))}
          </div>

          {/* Risk distribution */}
          {stats && stats.total > 0 && (
            <div className="result-card" style={{marginBottom:16}}>
              <p className="result-section-title">Risk Distribution</p>
              <div className="risk-dist">
                {(["Low","Medium","High"] as const).map(r => {
                  const count = stats.risk_distribution[r] ?? 0;
                  const pct = stats.total > 0 ? Math.round((count/stats.total)*100) : 0;
                  const col = r==="Low" ? "#2e7d5e" : r==="Medium" ? "#b07d28" : "#c0392b";
                  return (
                    <div key={r} className="risk-dist-item">
                      <span className={`risk-badge risk-${r.toLowerCase()}`}>{r}</span>
                      <div className="risk-dist-track">
                        <div className="risk-dist-fill" style={{width:`${pct}%`, background:col}}/>
                      </div>
                      <span className="risk-dist-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent analyses */}
          <div className="result-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <p className="result-section-title" style={{marginBottom:0}}>Recent Analyses</p>
              <a href="/history" className="btn-ghost" style={{fontSize:12,padding:"5px 12px"}}
                onClick={e=>{e.preventDefault();go("/history")}}>View all →</a>
            </div>
            {recent.length===0 ? (
              <div className="empty-cta">
                <p>No analyses yet.</p>
                <a href="/analyze" className="btn-primary" onClick={e=>{e.preventDefault();go("/analyze")}}>
                  Run your first analysis →
                </a>
              </div>
            ) : (
              <table className="doc-table">
                <thead><tr><th>Date</th><th>Title</th><th>Brand System</th><th>Score</th><th>Risk</th></tr></thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id} className="table-row-clickable" id={`recent-${r.id}`}
                      onClick={()=>nav(`/analysis/${r.id}`)}>
                      <td className="td-muted">{r.analyzed_at?.slice(0,10)}</td>
                      <td className="td-bold">{r.message_title}</td>
                      <td className="td-muted">{r.brand_system_name}</td>
                      <td><span className={`score-pill ${scoreClass(r.clarity_score)}`}>{r.clarity_score}</span></td>
                      <td><span className={`risk-badge ${RISK_CLASS[r.narrative_risk]}`}>{r.narrative_risk}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            {[
              {path:"/analyze",          icon:"🔍", label:"Analyser un message",   sub:"Evaluate against your Brand System"},
              {path:"/brand-system/new", icon:"🏷",  label:"Nouveau Brand System",  sub:"Define your brand governance reference"},
              {path:"/history",          icon:"📋", label:"Historique",              sub:"Browse all past analyses"},
            ].map(a => (
              <a key={a.path} href={a.path} className="quick-card" id={`quick-${a.label.toLowerCase().replace(/\s/g,"_")}`}
                onClick={e=>{e.preventDefault();go(a.path)}}>
                <span className="quick-icon">{a.icon}</span>
                <p className="quick-label">{a.label}</p>
                <p className="quick-sub">{a.sub}</p>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
