import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import AppSidebar from "../../components/AppSidebar";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000");

const NAV = [
  { path: "/admin/clients",   label: "Clients",    icon: "◈" },
  { path: "/admin/analytics", label: "Analytiques", icon: "✦" },
  { path: "/history",         label: "Historique", icon: "◷" },
];

interface BrandSystemSummary { id: number; brand_name: string; version: number; }
interface ClientRow {
  id: number; company_name: string; sector: string | null;
  created_at: string | null; brand_systems: BrandSystemSummary[]; user_count: number;
}
interface GlobalStats {
  total_analyses: number; avg_score: number | null;
  total_cost: number; currency: string; pct_high_risk: number;
}

export default function ClientList() {
  const nav = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [stats,   setStats]   = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    fetch(`${API}/api/admin/clients`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => {
        if (r.status === 401) { logout(); window.location.href = "/login"; }
        if (!r.ok) throw new Error("Impossible de charger les clients");
        return r.json();
      })
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    fetch(`${API}/api/admin/stats`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const filtered = clients.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.sector ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-root">
      <AppSidebar role="admin" navItems={NAV} />

      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-primary)", padding: 28 }}>
        <div>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400, color: "var(--text-primary)", marginBottom: 4 }}>
                Comptes clients
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {clients.length} organisation{clients.length !== 1 ? "s" : ""} enregistrée{clients.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button id="btn-new-client" className="btn-primary"
              onClick={() => nav("/admin/clients/new")}>
              + Nouveau client
            </button>
          </div>

          {/* Decision KPIs — platform-wide spend and risk exposure */}
          {stats && (
            <div className="kpi-grid" style={{ marginBottom: 22 }}>
              <div className="kpi-card" style={{ "--kpi-color": "#2e7d5e" } as React.CSSProperties}>
                <div className="kpi-top"><span className="kpi-label">Coût total plateforme</span></div>
                <p className="kpi-value kpi-value-sm">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: stats.currency || "USD", maximumFractionDigits: 2 }).format(stats.total_cost)}
                </p>
                <div className="kpi-bar" />
              </div>
              <div className="kpi-card" style={{ "--kpi-color": stats.pct_high_risk > 20 ? "#c0392b" : "#b07d28" } as React.CSSProperties}>
                <div className="kpi-top"><span className="kpi-label">% Analyses à risque élevé</span></div>
                <p className="kpi-value kpi-value-sm">{stats.pct_high_risk}%</p>
                <div className="kpi-bar" />
              </div>
            </div>
          )}

          {/* Search */}
          {clients.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher par nom ou secteur…"
                style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "inherit", fontSize: 13, padding: "10px 16px", outline: "none" }} />
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-dim)", padding: "40px 0" }}>
              <div className="spinner" /> Chargement des clients…
            </div>
          )}
          {error && <p style={{ color: "var(--danger)", padding: "24px 0" }}>{error}</p>}

          {!loading && !error && clients.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 24px", background: "var(--bg2)", border: "1.5px dashed var(--border)", borderRadius: 16, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem" }}>◈</div>
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Aucun client pour le moment. Créez le premier.</p>
              <button className="btn-primary" style={{ background: "#fdd335", color: "#0b1622", border: "none", fontWeight: 700 }}
                onClick={() => nav("/admin/clients/new")}>
                Créer votre premier client →
              </button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((c, i) => (
                <div key={c.id} id={`client-row-${c.id}`}
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 16 }}
                  onMouseEnter={(e) => { const d = e.currentTarget; d.style.background = "var(--bg3)"; d.style.borderColor = "rgba(253,211,53,0.3)"; }}
                  onMouseLeave={(e) => { const d = e.currentTarget; d.style.background = "var(--bg2)"; d.style.borderColor = "var(--border)"; }}
                  onClick={() => nav(`/admin/clients/${c.id}`)}>

                  <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `hsl(${(i * 67) % 360}, 35%, 18%)`, border: `1px solid hsl(${(i * 67) % 360}, 50%, 28%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: `hsl(${(i * 67) % 360}, 70%, 72%)` }}>
                    {c.company_name.slice(0, 1).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{c.company_name}</span>
                      {c.sector && (
                        <span style={{ background: "rgba(201,164,73,0.06)", border: "1px solid rgba(201,164,73,0.15)", borderRadius: 4, color: "var(--gold)", fontWeight: 500, fontSize: 11, padding: "2px 8px" }}>{c.sector}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-dim)" }}>
                      <span>Créé le {c.created_at?.slice(0, 10) ?? "—"}</span>
                      <span>·</span>
                      <span>{c.user_count} membre{c.user_count !== 1 ? "s" : ""}</span>
                      {c.brand_systems.length > 0 && (
                        <>
                          <span>·</span>
                      <span style={{ color: "var(--gold-border)" }}>{c.brand_systems.map((bs) => `${bs.brand_name} v${bs.version}`).join(", ")}</span>
                        </>
                      )}
                      {c.brand_systems.length === 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: "var(--score-low-fg)", opacity: 0.8 }}>Aucun brand system</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button id={`btn-edit-client-${c.id}`}
                      style={{ padding: "6px 14px", borderRadius: 6, background: "var(--gold-dim)", border: "1px solid var(--gold-border)", color: "var(--gold)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.13s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,164,73,0.18)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--gold-dim)")}
                      onClick={() => nav(`/admin/clients/${c.id}`)}>
                      Modifier
                    </button>
                  </div>
                </div>
              ))}

              {search && filtered.length === 0 && (
                <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                  Aucun client ne correspond à "{search}".
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
