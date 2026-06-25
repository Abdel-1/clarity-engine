import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAdmin, isBrandAdmin } from "../services/auth";
import { getMemberUnreviewed, getBrandUnreviewed, getAdminUnreviewed } from "../services/brandSystems";
import AppSidebar from "../components/AppSidebar";

interface UnreviewedItem {
  id: number;
  title: string;
  score: number;
  date: string | null;
  author: string | null;
  conversation_id: string | null;
}

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

/* ── Skeleton row ───────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr style={{ animation: "skeletonPulse 1.4s ease-in-out infinite" }}>
      {[80, 320, 160, 70].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px" }}>
          <div style={{ height: 12, width: w, borderRadius: 6, background: "var(--bg3)", opacity: 0.7 }} />
        </td>
      ))}
    </tr>
  );
}

export default function UnreviewedList() {
  const nav = useNavigate();
  const admin   = isAdmin();
  const brandAdmin = isBrandAdmin();

  const [items, setItems]     = useState<UnreviewedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const NAV  = admin ? NAV_ADMIN : brandAdmin ? NAV_BRAND : NAV_MEMBRE;
  const role = admin ? "admin" as const : brandAdmin ? "brand_admin" as const : "membre" as const;
  const dashPath = admin ? "/admin/analytics" : brandAdmin ? "/brand/dashboard" : "/";

  useEffect(() => {
    const fetch = admin
      ? getAdminUnreviewed
      : brandAdmin
        ? getBrandUnreviewed
        : getMemberUnreviewed;

    fetch()
      .then((data: UnreviewedItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(item =>
    !search ||
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.author || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard-root">
      <AppSidebar role={role} navItems={NAV} />

      <main className="dashboard-main">
        <div className="page-content">

          {/* ── Header ── */}
          <header className="dash-header" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Back button */}
              <button
                onClick={() => nav(dashPath)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                  color: "var(--text-dim)", fontSize: 13, fontFamily: "inherit",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-dim)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-dim)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
              >
                ← Tableau de bord
              </button>
              <div>
                <h1 className="dash-title" style={{ margin: 0 }}>
                  Contenus non révisés
                </h1>
                <p className="dash-subtitle" style={{ margin: 0 }}>
                  Risques élevés sans aucune itération d'amélioration
                </p>
              </div>
            </div>
          </header>

          {/* ── Alert banner ── */}
          {!loading && items.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(224,82,82,0.07)",
              border: "1px solid rgba(224,82,82,0.25)",
              borderRadius: 12, padding: "12px 18px", marginBottom: 20,
            }}>
              <span style={{ fontSize: "1.2rem" }}>△</span>
              <p style={{ fontSize: 13, color: "#e05252", fontWeight: 500, margin: 0 }}>
                <strong>{items.length}</strong> analyse{items.length > 1 ? "s" : ""} à risque élevé n'ont jamais été corrigées.
                Cliquez sur une ligne pour accéder au résultat et lancer une réécriture.
              </p>
            </div>
          )}

          {/* ── Search ── */}
          {!loading && items.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <input
                className="filter-input"
                placeholder="Rechercher par titre ou auteur…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 420, borderRadius: "var(--radius-xs)" }}
              />
            </div>
          )}

          {/* ── Table ── */}
          <div className="result-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Date</th>
                  <th>Titre</th>
                  <th style={{ width: 180 }}>Auteur</th>
                  <th style={{ width: 90, textAlign: "center" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "56px 24px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                        {search ? (
                          <>
                            <span style={{ fontSize: "2rem" }}>▤</span>
                            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Aucun résultat pour « {search} »</p>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: "2.4rem" }}>✅</span>
                            <p style={{ color: "var(--text-dim)", fontSize: 14, fontWeight: 500 }}>
                              Aucun contenu à risque élevé non révisé
                            </p>
                            <p style={{ color: "var(--text-dim)", fontSize: 12, marginTop: -8 }}>
                              Tous les risques élevés ont été suivis d'au moins une itération.
                            </p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => (
                    <tr
                      key={item.id}
                      className="table-row-clickable"
                      onClick={() => {
                        // Members → conversation thread (has "Continuer l'analyse" button)
                        // Admins / brand admins → analysis result
                        if (!admin && !brandAdmin && item.conversation_id) {
                          nav(`/history/${item.conversation_id}`);
                        } else {
                          nav(`/analysis/${item.id}`);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="td-muted" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                        {item.date}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {/* Risk indicator dot */}
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#e05252", flexShrink: 0,
                            boxShadow: "0 0 6px rgba(224,82,82,0.5)",
                          }} />
                          <span className="td-bold" style={{
                            overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", maxWidth: 400,
                            display: "block",
                          }}>
                            {item.title}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.author ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                              background: `hsl(${(item.author.charCodeAt(0) * 37) % 360}, 55%, 42%)`,
                              color: "#fff", fontSize: 10, fontWeight: 700,
                            }}>
                              {item.author.slice(0, 1).toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.author}
                            </span>
                          </span>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 12px", borderRadius: 100,
                          background: "rgba(224,82,82,0.13)",
                          color: "#e05252", fontWeight: 700, fontSize: 13,
                        }}>
                          {item.score}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Result count */}
          {!loading && filtered.length > 0 && (
            <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "right" }}>
              {filtered.length} élément{filtered.length > 1 ? "s" : ""}
              {search && items.length !== filtered.length ? ` sur ${items.length}` : ""}
            </p>
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
