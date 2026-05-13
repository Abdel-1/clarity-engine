import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout, isAdmin } from "../services/auth";
import { getStats, getAnalyses } from "../services/brandSystems";
import logoSvg from "../assets/logo.svg";

interface Stats {
  total: number; avg_score: number; last_score: number | null;
  best_improvement: number | null;
  avg_before_rewrite: number | null; avg_after_rewrite: number | null;
  top_scorers: { title: string; score: number; date: string; id: number }[];
}
interface Row {
  id: number; message_title: string; brand_system_name: string;
  clarity_score: number; analyzed_at: string;
}

const scoreColor = (s: number) => s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";

const NAV_CLIENT = [
  { path: "/",                    label: "Dashboard" },
  { path: "/analyze",             label: "Analyser" },
  { path: "/brand-system/new",    label: "Brand Systems" },
  { path: "/brand-system/import", label: "Importer un Brand" },
  { path: "/history",             label: "Historique" },
];
const NAV_ADMIN = [
  { path: "/admin",               label: "🛡 Admin Panel" },
  { path: "/",                    label: "Dashboard" },
  { path: "/analyze",             label: "Analyser" },
  { path: "/brand-system/new",    label: "Brand Systems" },
  { path: "/brand-system/import", label: "Importer un Brand" },
  { path: "/history",             label: "Historique" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const admin = isAdmin();
  const NAV = admin ? NAV_ADMIN : NAV_CLIENT;
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Row[]>([]);
  const [active, setActive] = useState("/");

  useEffect(() => {
    getStats().then(setStats);
    getAnalyses().then(d => setRecent(d.slice(0, 5)));
  }, []);

  const go = (path: string) => { setActive(path); nav(path); };

  return (
    <div className="dashboard-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logoSvg} alt="Zone Bleue" style={{ height: 30, maxWidth: "100%" }} />
          {admin && (
            <span style={{ fontSize: 9, background: "var(--accent)", color: "#fff", padding: "2px 7px", borderRadius: 100, fontWeight: 700, marginTop: 4, display: "inline-block" }}>
              ADMIN
            </span>
          )}
        </div>
        <nav className="sidebar-nav">
          <div style={{ marginBottom: 6, padding: "0 8px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.9px" }}>
            Navigation
          </div>
          {NAV.map(n => (
            <a key={n.path} href={n.path}
              className={`nav-item${active === n.path ? " active" : ""}`}
              onClick={e => { e.preventDefault(); go(n.path); }}>
              {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>
          Sign Out
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div className="page-content" style={{ maxWidth: 920 }}>
          <header className="dash-header">
            <div>
              <h1 className="dash-title">Brand Governance</h1>
              <p className="dash-subtitle">Clarity Engine · Communication analysis platform</p>
            </div>
            <a href="/analyze" className="btn-primary" onClick={e => { e.preventDefault(); go("/analyze"); }}>
              + Nouvelle analyse
            </a>
          </header>

          {/* KPIs — 4 cards, no risk */}
          <div className="kpi-grid">
            {[
              { label: "Total Analyses",       value: stats?.total ?? "—",                                        color: "#2a5298" },
              { label: "Score Moyen",           value: stats ? `${stats.avg_score}/100` : "—",                    color: "#2e7d5e" },
              { label: "Dernier Score",         value: stats?.last_score != null ? `${stats.last_score}/100` : "—", color: "#b07d28" },
              { label: "Meilleure Amélioration",value: stats?.best_improvement != null ? `+${stats.best_improvement} pts` : "—", color: "#2a5298" },
            ].map(k => (
              <div key={k.label} className="kpi-card" style={{ "--kpi-color": k.color } as React.CSSProperties}>
                <div className="kpi-top"><span className="kpi-label">{k.label}</span></div>
                <p className={`kpi-value${String(k.value).length > 6 ? " kpi-value-sm" : ""}`}>{k.value}</p>
                <div className="kpi-bar" />
              </div>
            ))}
          </div>

          {/* Before / After rewrite card */}
          {stats && (stats.avg_before_rewrite != null || stats.avg_after_rewrite != null) && (
            <div className="result-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
              <p className="result-section-title" style={{ marginBottom: 12 }}>Progression par réécriture IA</p>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)", marginBottom: 4 }}>Score Départ</p>
                  <p style={{ fontFamily: "'Lora',serif", fontSize: "2rem", fontWeight: 600, color: scoreColor(stats.avg_before_rewrite ?? 0) }}>
                    {stats.avg_before_rewrite ?? "—"}
                  </p>
                </div>
                <div style={{ fontSize: "1.5rem", color: "var(--text-dim)" }}>→</div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)", marginBottom: 4 }}>Score Arrivée</p>
                  <p style={{ fontFamily: "'Lora',serif", fontSize: "2rem", fontWeight: 600, color: scoreColor(stats.avg_after_rewrite ?? 0) }}>
                    {stats.avg_after_rewrite ?? "—"}
                  </p>
                </div>
                {stats.avg_before_rewrite != null && stats.avg_after_rewrite != null && (
                  <div style={{ marginLeft: "auto", background: "rgba(46,125,94,0.08)", border: "1px solid rgba(46,125,94,0.2)", borderRadius: "var(--radius-xs)", padding: "8px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 2 }}>Amélioration moy.</p>
                    <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "#2e7d5e" }}>
                      +{(stats.avg_after_rewrite - stats.avg_before_rewrite).toFixed(1)} pts
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content that hit 95%+ */}
          {stats && stats.top_scorers?.length > 0 && (
            <div className="result-card" style={{ marginBottom: 16, padding: "16px 20px" }}>
              <p className="result-section-title" style={{ marginBottom: 12 }}>🏆 Contenu ayant atteint 95%+</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.top_scorers.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < stats.top_scorers.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                    onClick={() => nav(`/analysis/${t.id}`)}>
                    <span style={{ fontFamily: "'Lora',serif", fontSize: "1.2rem", fontWeight: 600, color: "#2e7d5e", flexShrink: 0 }}>{t.score}/100</span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{t.title}</span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.date?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent analyses — no risk column */}
          <div className="result-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p className="result-section-title" style={{ marginBottom: 0 }}>Analyses Récentes</p>
              <a href="/history" className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={e => { e.preventDefault(); go("/history"); }}>View all →</a>
            </div>
            {recent.length === 0 ? (
              <div className="empty-cta">
                <p>No analyses yet.</p>
                <a href="/analyze" className="btn-primary" onClick={e => { e.preventDefault(); go("/analyze"); }}>
                  Run your first analysis →
                </a>
              </div>
            ) : (
              <table className="doc-table">
                <thead><tr><th>Date</th><th>Titre</th><th>Brand System</th><th>Score /100</th></tr></thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id} className="table-row-clickable" onClick={() => nav(`/analysis/${r.id}`)}>
                      <td className="td-muted">{r.analyzed_at?.slice(0, 10)}</td>
                      <td className="td-bold">{r.message_title}</td>
                      <td className="td-muted">{r.brand_system_name}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, maxWidth: 80, height: 5, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${r.clarity_score}%`, background: scoreColor(r.clarity_score), borderRadius: 3 }} />
                          </div>
                          <span className={`score-pill`} style={{ background: scoreColor(r.clarity_score) + "18", color: scoreColor(r.clarity_score), border: `1px solid ${scoreColor(r.clarity_score)}40` }}>
                            {r.clarity_score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            {[
              { path: "/analyze",           icon: "🔍", label: "Analyser un message", sub: "Évaluer contre votre Brand System" },
              { path: "/brand-system/new",  icon: "🏷",  label: "Nouveau Brand System", sub: "Définir votre référence de gouvernance" },
              { path: "/history",           icon: "📋", label: "Historique",           sub: "Parcourir toutes les analyses passées" },
            ].map(a => (
              <a key={a.path} href={a.path} className="quick-card"
                onClick={e => { e.preventDefault(); go(a.path); }}>
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
