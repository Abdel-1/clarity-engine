import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import { useTheme } from "../context/ThemeContext";

export type PanelRole = "admin" | "brand_admin" | "membre";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface Props {
  role: PanelRole;
  companyName?: string;
  navItems: NavItem[];
}

const PANEL_META: Record<PanelRole, { label: string; accent: string; accentDim: string; accentBorder: string }> = {
  admin: {
    label: "Admin Panel",
    accent: "#C9A449",
    accentDim: "rgba(201,164,73,0.08)",
    accentBorder: "rgba(201,164,73,0.25)",
  },
  brand_admin: {
    label: "Brand Admin",
    accent: "#C9A449",
    accentDim: "rgba(201,164,73,0.08)",
    accentBorder: "rgba(201,164,73,0.25)",
  },
  membre: {
    label: "Espace Membre",
    accent: "#C9A449",
    accentDim: "rgba(201,164,73,0.08)",
    accentBorder: "rgba(201,164,73,0.25)",
  },
};

export default function AppSidebar({ role, companyName, navItems }: Props) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const meta = PANEL_META[role];
  const { theme, toggleTheme } = useTheme();

  // Mobile drawer open/close state. Desktop ignores this (CSS keeps it visible).
  const [open, setOpen] = useState(false);

  // Auto-close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const isActive = (path: string) =>
    path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(path + "/");

  const go = (path: string) => { setOpen(false); nav(path); };

  return (
    <>
      {/* Mobile hamburger toggle — hidden on desktop via CSS */}
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
        </svg>
      </button>

      {/* Backdrop — only visible when the drawer is open on mobile */}
      <div
        className={`sidebar-backdrop${open ? " show" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

    <aside
      className={`app-sidebar${open ? " open" : ""}`}
      style={{
        width: "var(--sidebar-w)",
        flexShrink: 0,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--bg-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Brand header */}
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--bg-border)",
        }}
      >
        {/* Logo mark */}
        <div style={{
          width: 38, height: 38,
          background: "rgba(201,164,73,0.08)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(201,164,73,0.25)",
          marginBottom: 12,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#C9A449" strokeWidth="1.75" width="18" height="18">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
        </div>

        <div style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 15, fontWeight: 400,
          color: "var(--text-primary)",
          marginBottom: 4,
        }}>
          Clarity Engine
        </div>

        <div style={{
          fontSize: 10, fontWeight: 700,
          color: `${meta.accent}cc`,
          textTransform: "uppercase", letterSpacing: "1.2px",
        }}>
          {meta.label}
        </div>

        {companyName && (
          <div style={{
            marginTop: 3, fontSize: 11,
            color: "var(--text-muted)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {companyName}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 10px" }}>
        {navItems.map((n) => {
          const active = isActive(n.path);
          return (
            <a
              key={n.path}
              href={n.path}
              onClick={(e) => { e.preventDefault(); go(n.path); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: active ? "9px 12px 9px 10px" : "9px 12px",
                borderRadius: 6, marginBottom: 2,
                textDecoration: "none", fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: "var(--font)",
                color: active ? meta.accent : "var(--text-muted)",
                background: active ? meta.accentDim : "transparent",
                border: active ? `1px solid ${meta.accentBorder}` : "1px solid transparent",
                borderLeft: active ? `2px solid ${meta.accent}` : "2px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <span style={{ fontSize: "1rem", width: 18, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </a>
          );
        })}
      </nav>

      {/* Profile & Logout */}
      <div style={{ borderTop: "1px solid var(--bg-border)" }}>
        <a
          href="/profile"
          onClick={(e) => { e.preventDefault(); go("/profile"); }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "12px 16px",
            background: "none", border: "none",
            color: pathname === "/profile" ? meta.accent : "var(--text-dim)",
            fontFamily: "var(--font)", fontSize: 13, cursor: "pointer",
            textDecoration: "none", transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (pathname !== "/profile") e.currentTarget.style.color = "var(--text-muted)";
          }}
          onMouseLeave={(e) => {
            if (pathname !== "/profile") e.currentTarget.style.color = "var(--text-dim)";
          }}
        >
          Mon Profil
        </a>
        <button
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "10px 16px",
            background: "none", border: "none",
            borderTop: "1px solid var(--bg-border)",
            color: "var(--text-dim)",
            fontFamily: "var(--font)", fontSize: 13, cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          onClick={toggleTheme}
        >
          <span style={{ fontSize: 14 }}>◐</span> Mode {theme === "dark" ? "clair" : "sombre"}
        </button>
        <button
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "10px 16px",
            background: "none", border: "none",
            borderTop: "1px solid var(--bg-border)",
            color: "var(--text-dim)",
            fontFamily: "var(--font)", fontSize: 13, cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          onClick={() => { logout(); window.location.href = "/login"; }}
        >
          <span>⏎</span> Déconnexion
        </button>
      </div>
    </aside>
    </>
  );
}
