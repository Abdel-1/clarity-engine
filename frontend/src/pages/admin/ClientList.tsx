import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../../services/auth";
import logoSvg from "../../assets/logo.svg";

const API = "http://127.0.0.1:8000";

const NAV_ADMIN = [
  { path: "/admin/clients",   label: "Clients",   icon: "◈" },
  { path: "/admin/analytics", label: "Analytics", icon: "✦" },
];

interface BrandSystemSummary { id: number; brand_name: string; version: number; }
interface ClientRow {
  id:           number;
  company_name: string;
  sector:       string | null;
  created_at:   string | null;
  brand_systems: BrandSystemSummary[];
  user_count:   number;
}

function Sidebar({ nav }: { nav: ReturnType<typeof useNavigate> }) {
  const path = window.location.pathname;
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
              color: path === n.path ? "#fdd335" : "rgba(255,255,255,0.55)",
              background: path === n.path ? "rgba(253,211,53,0.08)" : "transparent",
              border: path === n.path ? "1px solid rgba(253,211,53,0.15)" : "1px solid transparent",
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

export default function ClientList() {
  const nav = useNavigate();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    fetch(`${API}/api/admin/clients`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => {
        if (r.status === 401) { logout(); window.location.href = "/login"; }
        if (!r.ok) throw new Error("Failed to load clients");
        return r.json();
      })
      .then(data => setClients(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.sector ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-root">
      <Sidebar nav={nav} />

      <main className="dashboard-main" style={{ background: "#0d1520" }}>
        <div style={{ maxWidth: 1000 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 500, color: "#fff", marginBottom: 4 }}>
                Client Accounts
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {clients.length} organisation{clients.length !== 1 ? "s" : ""} registered
              </p>
            </div>
            <button id="btn-new-client" className="btn-primary"
              style={{ background: "#fdd335", color: "#0f1923", border: "none", fontWeight: 600 }}
              onClick={() => nav("/admin/clients/new")}>
              + New Client
            </button>
          </div>

          {/* Search */}
          {clients.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍  Search clients by name or sector…"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, color: "rgba(255,255,255,0.7)", fontFamily: "inherit",
                  fontSize: 13, padding: "10px 16px", outline: "none",
                }}
              />
            </div>
          )}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>
              <div className="spinner" style={{ borderTopColor: "#2a5298", width: 22, height: 22, borderWidth: 2 }} />
              Loading clients…
            </div>
          )}
          {error && <p style={{ color: "#c0392b", padding: "24px 0" }}>{error}</p>}

          {!loading && !error && clients.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "64px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px dashed rgba(255,255,255,0.08)", borderRadius: 16, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem" }}>◈</div>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No clients yet. Create your first one.</p>
              <button className="btn-primary" style={{ background: "#fdd335", color: "#0f1923", border: "none", fontWeight: 600 }}
                onClick={() => nav("/admin/clients/new")}>
                Create your first client →
              </button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((c, i) => (
                <div key={c.id} id={`client-row-${c.id}`}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14, padding: "18px 20px", cursor: "pointer",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 16,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(42,82,152,0.4)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                  onClick={() => nav(`/admin/clients/${c.id}`)}>

                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `hsl(${(i * 67) % 360}, 35%, 22%)`,
                    border: `1px solid hsl(${(i * 67) % 360}, 50%, 35%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: `hsl(${(i * 67) % 360}, 60%, 72%)`,
                  }}>
                    {c.company_name.slice(0, 1).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{c.company_name}</span>
                      {c.sector && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "rgba(42,82,152,0.2)", color: "#7ba7e8", fontWeight: 500 }}>
                          {c.sector}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                      <span>Created {c.created_at?.slice(0, 10) ?? "—"}</span>
                      <span>·</span>
                      <span>{c.user_count} user{c.user_count !== 1 ? "s" : ""}</span>
                      {c.brand_systems.length > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: "rgba(253,211,53,0.6)" }}>
                            {c.brand_systems.map(bs => `${bs.brand_name} v${bs.version}`).join(", ")}
                          </span>
                        </>
                      )}
                      {c.brand_systems.length === 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: "rgba(192,57,43,0.7)" }}>No brand system</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                      id={`btn-edit-client-${c.id}`}
                      style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(253,211,53,0.1)", border: "1px solid rgba(253,211,53,0.3)", color: "#fdd335", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.13s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(253,211,53,0.2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(253,211,53,0.1)")}
                      onClick={() => nav(`/admin/clients/${c.id}`)}>
                      Edit Client
                    </button>
                  </div>
                </div>
              ))}

              {search && filtered.length === 0 && (
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                  No clients match "{search}".
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
