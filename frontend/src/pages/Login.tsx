import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, saveToken, saveRole } from "../services/auth";
import { useTheme } from "../context/ThemeContext";
import heroBg from "../assets/hero-city.jpg";

export default function Login() {
  const nav = useNavigate();
  const { toggleTheme } = useTheme();
  void toggleTheme; // kept for theme context but not exposed in UI

  const [showModal, setShowModal] = useState(false);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  /* Lock page in dark mode */
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme") ?? "dark";
    root.setAttribute("data-theme", "dark");
    root.style.background = "#04071A";
    document.body.style.background = "#04071A";
    return () => {
      root.setAttribute("data-theme", prev);
      root.style.background = "";
      document.body.style.background = "";
    };
  }, []);

  /* Close modal on Escape */
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await login(email, password);
      saveToken(res.access_token);
      saveRole(res.role || "membre");
      nav(res.role === "admin" ? "/admin/clients" : "/");
    } catch {
      setError("Email ou mot de passe invalide.");
    } finally { setLoading(false); }
  };

  return (
    <div data-theme="dark" style={{ background: "#04071A", minHeight: "100vh", color: "#FFF", fontFamily: "'Inter','DM Sans',system-ui,sans-serif" }}>
      {/* ── Global styles & keyframes ── */}
      <style>{`
        html, body { background: #04071A !important; scroll-behavior: smooth; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(-12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes float1 {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes float2 {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes waveShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes particleFly {
          0%   { transform: translateY(0)   translateX(0)   scale(1);   opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(-70vh) translateX(30px) scale(0.4); opacity: 0; }
        }

        .ce-signin-btn {
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s !important;
        }
        .ce-signin-btn:hover {
          background: #1D4ED8 !important;
          transform: translateY(-3px);
          box-shadow: 0 16px 48px rgba(37,99,235,0.6) !important;
        }
        .ce-feature-card {
          transition: border-color 0.2s, background 0.2s;
        }
        .ce-feature-card:hover {
          border-color: rgba(59,130,246,0.45) !important;
          background: rgba(15,30,70,0.65) !important;
        }
        .ce-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .ce-input::placeholder { color: #3D4D60; }
        .ce-input:focus {
          border-color: #3B82F6 !important;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.18) !important;
          outline: none;
        }
        .ce-se-connecter { transition: color 0.15s; }
        .ce-se-connecter:hover { color: #60A5FA !important; }

        @media (max-width: 720px) {
          .ce-features-grid { grid-template-columns: 1fr !important; }
          .ce-title { font-size: 52px !important; }
          .ce-floating-icon { display: none !important; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════
          LOGIN MODAL OVERLAY
      ══════════════════════════════════════════════════ */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(2,5,20,0.88)",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div style={{
            background: "#0A1628",
            border: "1px solid rgba(59,130,246,0.22)",
            borderRadius: 16,
            padding: "44px 40px",
            width: "100%", maxWidth: 400,
            animation: "modalIn 0.25s ease",
            boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 80px rgba(37,99,235,0.06)",
          }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                fontSize: 20, fontWeight: 900, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#FFFFFF", marginBottom: 6,
              }}>
                CLARITY ENGINE
                <sup style={{ fontSize: 10, verticalAlign: "super", letterSpacing: 0 }}>™</sup>
              </div>
              <div style={{
                width: 40, height: 2,
                background: "#2563EB",
                margin: "10px auto 12px",
                borderRadius: 2,
              }} />
              <div style={{ fontSize: 12, color: "#64748B", letterSpacing: "0.04em" }}>
                Connectez-vous à votre espace
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: "block", fontSize: 10.5, fontWeight: 700,
                  color: "#94A3B8", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6,
                }}>Email</label>
                <input
                  id="email" type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required autoFocus
                  className="ce-input"
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "#060E22",
                    border: "1px solid rgba(59,130,246,0.18)",
                    borderRadius: 8, color: "#FFFFFF",
                    fontSize: 14, boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 22 }}>
                <label style={{
                  display: "block", fontSize: 10.5, fontWeight: 700,
                  color: "#94A3B8", textTransform: "uppercase",
                  letterSpacing: "0.1em", marginBottom: 6,
                }}>Mot de passe</label>
                <input
                  id="password" type="password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="ce-input"
                  style={{
                    width: "100%", padding: "12px 14px",
                    background: "#060E22",
                    border: "1px solid rgba(59,130,246,0.18)",
                    borderRadius: 8, color: "#FFFFFF",
                    fontSize: 14, boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  background: "rgba(248,113,113,0.07)",
                  border: "1px solid rgba(248,113,113,0.22)",
                  borderRadius: 7, color: "#F87171",
                  fontSize: 12, padding: "10px 14px", marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="login-btn" type="submit" disabled={loading}
                style={{
                  width: "100%", padding: "14px 24px",
                  background: loading ? "rgba(37,99,235,0.45)" : "#2563EB",
                  color: "#FFFFFF",
                  border: "none", borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.05em",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 6px 24px rgba(37,99,235,0.4)",
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#1D4ED8"; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#2563EB"; }}
              >
                {loading ? "Connexion en cours…" : "Se connecter"}
              </button>
            </form>

            <button
              onClick={() => setShowModal(false)}
              style={{
                display: "block", width: "100%", marginTop: 14,
                background: "none", border: "none",
                color: "#475569", fontSize: 12,
                cursor: "pointer", textAlign: "center",
                fontFamily: "inherit",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#94A3B8"}
              onMouseLeave={e => e.currentTarget.style.color = "#475569"}
            >
              ← Retour
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          LANDING PAGE
      ══════════════════════════════════════════════════ */}
      <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>

        {/* ── Background: dark blue cityscape ── */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center 60%",
          filter: "brightness(0.18) saturate(0.2) hue-rotate(200deg)",
        }} />

        {/* ── Blue digital atmosphere overlays ── */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(175deg, rgba(4,7,26,0.7) 0%, rgba(6,18,60,0.3) 45%, rgba(4,7,26,0.88) 100%)",
          pointerEvents: "none",
        }} />
        {/* Bottom-left particle glow */}
        <div style={{
          position: "absolute",
          bottom: -80, left: "-10%",
          width: "65%", height: "60%",
          background: "radial-gradient(ellipse, rgba(29,78,216,0.28) 0%, transparent 68%)",
          pointerEvents: "none", borderRadius: "50%",
        }} />
        {/* Bottom-right particle glow */}
        <div style={{
          position: "absolute",
          bottom: -80, right: "-10%",
          width: "65%", height: "60%",
          background: "radial-gradient(ellipse, rgba(29,78,216,0.22) 0%, transparent 68%)",
          pointerEvents: "none", borderRadius: "50%",
        }} />
        {/* Center top glow */}
        <div style={{
          position: "absolute",
          top: "-5%", left: "50%",
          transform: "translateX(-50%)",
          width: "80%", height: "50%",
          background: "radial-gradient(ellipse, rgba(37,99,235,0.08) 0%, transparent 65%)",
          pointerEvents: "none", borderRadius: "50%",
        }} />

        {/* ── Floating icon badges ── */}
        {/* Speech bubble — top-left */}
        <div className="ce-floating-icon" style={{
          position: "absolute", top: "17%", left: "9%",
          width: 52, height: 52, borderRadius: "50%",
          border: "1.5px solid rgba(59,130,246,0.5)",
          background: "rgba(8,16,48,0.72)",
          backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "float1 4.2s ease-in-out infinite",
          boxShadow: "0 0 24px rgba(59,130,246,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          zIndex: 2,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        {/* Shield — left */}
        <div className="ce-floating-icon" style={{
          position: "absolute", top: "33%", left: "5%",
          width: 44, height: 44, borderRadius: "50%",
          border: "1.5px solid rgba(59,130,246,0.38)",
          background: "rgba(8,16,48,0.72)",
          backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "float2 5.5s 0.8s ease-in-out infinite",
          boxShadow: "0 0 18px rgba(59,130,246,0.16)",
          zIndex: 2,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        {/* Trend arrow — top-right */}
        <div className="ce-floating-icon" style={{
          position: "absolute", top: "17%", right: "9%",
          width: 52, height: 52, borderRadius: "50%",
          border: "1.5px solid rgba(59,130,246,0.5)",
          background: "rgba(8,16,48,0.72)",
          backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "float1 3.8s 0.4s ease-in-out infinite",
          boxShadow: "0 0 24px rgba(59,130,246,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          zIndex: 2,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
        </div>
        {/* Globe — right */}
        <div className="ce-floating-icon" style={{
          position: "absolute", top: "33%", right: "5%",
          width: 44, height: 44, borderRadius: "50%",
          border: "1.5px solid rgba(59,130,246,0.38)",
          background: "rgba(8,16,48,0.72)",
          backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "float2 4.8s 1.2s ease-in-out infinite",
          boxShadow: "0 0 18px rgba(59,130,246,0.16)",
          zIndex: 2,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>

        {/* ══════════════ HERO CONTENT ══════════════ */}
        <div style={{
          position: "relative", zIndex: 3,
          display: "flex", flexDirection: "column",
          alignItems: "center", textAlign: "center",
          paddingTop: 80, paddingLeft: 24, paddingRight: 24,
        }}>

          {/* Main title */}
          <h1
            className="ce-title"
            style={{
              fontSize: "clamp(54px, 9vw, 100px)",
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#FFFFFF",
              margin: "0 0 18px",
              lineHeight: 1,
              animation: "fadeUp 0.8s 0.1s both",
              textShadow: "0 0 100px rgba(255,255,255,0.15), 0 4px 40px rgba(0,0,0,0.6)",
            }}
          >
            CLARITY ENGINE
            <sup style={{
              fontSize: "0.28em",
              verticalAlign: "super",
              letterSpacing: 0,
              fontWeight: 800,
            }}>™</sup>
          </h1>

          {/* Tagline with lines */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            marginBottom: 26,
            animation: "fadeUp 0.8s 0.28s both",
          }}>
            <div style={{ height: 1, width: 55, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.28))" }} />
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "#CBD5E1", whiteSpace: "nowrap",
            }}>
              LA GOUVERNANCE DE MARQUE{" "}
              <span style={{ color: "#3B82F6", fontWeight: 800 }}>IA AUGMENTÉE</span>
            </span>
            <div style={{ height: 1, width: 55, background: "linear-gradient(to left, transparent, rgba(255,255,255,0.28))" }} />
          </div>

          {/* Description */}
          <p style={{
            fontSize: 16, color: "#CBD5E1", lineHeight: 1.7,
            maxWidth: 500, margin: "0 auto 38px",
            animation: "fadeUp 0.8s 0.4s both",
          }}>
            Evaluez chaque contenu avant sa diffusion,<br />
            et obtenez des recommandations actionnables.
          </p>

          {/* ★ Sign In button (ONLY interactive CTA) */}
          <div style={{ animation: "fadeUp 0.8s 0.54s both", marginBottom: 18 }}>
            <button
              id="landing-signin-btn"
              className="ce-signin-btn"
              onClick={() => setShowModal(true)}
              style={{
                padding: "17px 72px",
                background: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                fontSize: 17, fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                boxShadow: "0 8px 32px rgba(37,99,235,0.5)",
              }}
            >
              Sign In
            </button>
          </div>

          {/* Sub-link */}
          <div style={{
            fontSize: 13, color: "#94A3B8",
            animation: "fadeUp 0.8s 0.64s both",
            marginBottom: 72,
          }}>
            Déjà un compte ?{" "}
            <span
              className="ce-se-connecter"
              onClick={() => setShowModal(true)}
              style={{ color: "#3B82F6", cursor: "pointer", fontWeight: 500 }}
            >
              Se connecter
            </span>
          </div>

          {/* ══════════════ FEATURES SECTION ══════════════ */}
          <div style={{
            width: "100%", maxWidth: 860,
            animation: "fadeUp 0.9s 0.72s both",
          }}>
            <h2 style={{
              fontSize: 17, fontWeight: 700,
              color: "#FFFFFF", textAlign: "center",
              marginBottom: 22, letterSpacing: "-0.01em",
            }}>
              Tout ce dont vous avez besoin pour une clarté de marque
            </h2>

            {/* Feature cards grid */}
            <div
              className="ce-features-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
                marginBottom: 14,
              }}
            >
              {/* Card: Analyse de messages */}
              <div className="ce-feature-card" style={{
                background: "rgba(8,18,48,0.58)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 12, padding: "22px 20px",
                backdropFilter: "blur(16px)",
                textAlign: "left",
              }}>
                <div style={{
                  width: 42, height: 42,
                  background: "rgba(37,99,235,0.12)",
                  border: "1px solid rgba(37,99,235,0.28)",
                  borderRadius: 10, marginBottom: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
                  Analyse de messages
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.65 }}>
                  Evaluez la clarté, la cohérence et la conformité de vos contenus en temps réel grâce à l'IA.
                </div>
              </div>

              {/* Card: Détection des risques */}
              <div className="ce-feature-card" style={{
                background: "rgba(8,18,48,0.58)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 12, padding: "22px 20px",
                backdropFilter: "blur(16px)",
                textAlign: "left",
              }}>
                <div style={{
                  width: 42, height: 42,
                  background: "rgba(37,99,235,0.12)",
                  border: "1px solid rgba(37,99,235,0.28)",
                  borderRadius: 10, marginBottom: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
                  Détection des risques
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.65 }}>
                  Identifiez les risques narratifs et protégez votre réputation sur tous vos canaux.
                </div>
              </div>

              {/* Card: Recommandations IA */}
              <div className="ce-feature-card" style={{
                background: "rgba(8,18,48,0.58)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 12, padding: "22px 20px",
                backdropFilter: "blur(16px)",
                textAlign: "left",
              }}>
                <div style={{
                  width: 42, height: 42,
                  background: "rgba(37,99,235,0.12)",
                  border: "1px solid rgba(37,99,235,0.28)",
                  borderRadius: 10, marginBottom: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.7">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>
                  Recommandations IA
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.65 }}>
                  Recevez des recommandations actionnables pour améliorer la clarté et renforcer l'impact de vos communications.
                </div>
              </div>
            </div>

            {/* Bottom tagline banner */}
            <div style={{
              background: "rgba(8,18,48,0.58)",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 12, padding: "20px 24px",
              backdropFilter: "blur(16px)",
              display: "flex", alignItems: "center", gap: 16,
              marginBottom: 0,
              position: "relative", overflow: "hidden",
              textAlign: "left",
            }}>
              {/* Right decorative wave */}
              <div style={{
                position: "absolute", right: 0, top: 0, bottom: 0, width: "38%",
                background: "radial-gradient(ellipse at right center, rgba(37,99,235,0.22) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* Sparkle / 4-pointed star */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.35 }}>
                  Une IA qui comprend votre marque.
                </div>
                <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 3 }}>
                  Conçue pour la clarté. Gouvernée pour la confiance.
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════ FOOTER ══════════════ */}
          <div style={{
            width: "100%", maxWidth: 860,
            margin: "0 auto",
            padding: "20px 0 44px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            marginTop: 20,
            animation: "fadeUp 0.9s 0.9s both",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              color: "#64748B", fontSize: 12,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.7">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Corporate Clarity Index Morocco
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)" }} />
              {/* ★ clarityindex.ma — ONLY external link */}
              <a
                id="clarityindex-link"
                href="https://clarityindex.ma"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#3B82F6",
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 5,
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#60A5FA")}
                onMouseLeave={e => (e.currentTarget.style.color = "#3B82F6")}
              >
                clarityindex.ma
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
