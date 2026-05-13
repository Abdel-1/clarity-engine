import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import { getBrandSystems, postAnalyze, getAnalysis, postRewrite } from "../services/brandSystems";
import logoSvg from "../assets/logo.svg";

/* ── Types ───────────────────────────────────── */
interface BS { id: number; brand_name: string; version: number; }
interface AnalysisData {
  id: number; message_title: string; brand_system_name: string;
  clarity_score: number; sub_clarity: number; sub_alignment: number;
  sub_focus: number; sub_tone: number; sub_narrative_contribution: number;
  narrative_risk: "Low" | "Medium" | "High";
  points_forts: string[]; points_faibles: string[]; recommandations: string[];
  message_body?: string;
}
type Msg =
  | { type: "user"; text: string }
  | { type: "result"; data: AnalysisData }
  | { type: "rewrite"; text: string; changes: string[]; originalBody: string }
  | { type: "error"; text: string }
  | { type: "typing"; label?: string };

const RISK_CLASS = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" };
const scoreColor = (s: number) => s >= 75 ? "#2e7d5e" : s >= 50 ? "#b07d28" : "#c0392b";
const subClass   = (v: number) => v >= 15 ? "good" : v >= 10 ? "warn" : "bad";

/* Keywords that trigger rewrite instead of fresh analysis */
const REWRITE_KEYWORDS = [
  "améliore", "améliorer", "enhance", "improve", "correct", "fix", "rewrite",
  "reformule", "reformuler", "rends", "plus court", "plus long", "plus formel",
  "plus impactant", "change le ton", "revise", "révise", "ajuste", "adjust",
  "modifie", "raccourcis", "développe", "simplify", "simplifie", "rephrase",
  "rewrite it", "make it", "rends-le", "corrige", "corrigez",
];
const isRewriteInstruction = (text: string, hasLastResult: boolean): boolean => {
  if (!hasLastResult) return false;
  if (text.trim().length > 300) return false;
  const lower = text.toLowerCase();
  return REWRITE_KEYWORDS.some(k => lower.includes(k));
};

const NAV_CLIENT = [
  { path: "/",        label: "Dashboard",  icon: "⬡" },
  { path: "/analyze", label: "Analyser",   icon: "✦" },
  { path: "/history", label: "Historique", icon: "◈" },
];

const SUGGESTIONS = [
  "Évaluer un communiqué de presse",
  "Analyser un post LinkedIn",
  "Vérifier un email institutionnel",
  "Tester un discours de direction",
];

/* ── Rewrite card ────────────────────────────── */
function RewriteCard({ text, changes, originalBody, onReanalyze }: {
  text: string; changes: string[]; originalBody: string;
  onReanalyze: (body: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="chat-analysis-card" style={{ maxWidth: 560 }}>
      <div className="chat-card-header">
        <span className="chat-card-label">✏️ Message réécrit</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{changes.length} changements</span>
      </div>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap" }}>{text}</p>
      </div>
      {changes.length > 0 && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <p className="chat-section-label">Changements effectués</p>
          {changes.map((c, i) => (
            <div key={i} className="rec-item info" style={{ marginBottom: 4 }}>✓ {c}</div>
          ))}
        </div>
      )}
      <div className="chat-card-footer">
        <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }} onClick={copy}>
          {copied ? "✓ Copié !" : "📋 Copier"}
        </button>
        <button className="btn-primary" style={{ fontSize: 11, padding: "5px 14px" }}
          onClick={() => onReanalyze(text)}>
          🔍 Analyser ce message →
        </button>
      </div>
    </div>
  );
}

/* ── Analysis card ───────────────────────────── */
function AnalysisCard({ data, nav, onRewrite }: {
  data: AnalysisData;
  nav: ReturnType<typeof useNavigate>;
  onRewrite: (body: string, faibles: string[], recs: string[]) => void;
}) {
  const subs = [
    { label: "Clarity",   val: data.sub_clarity },
    { label: "Alignment", val: data.sub_alignment },
    { label: "Focus",     val: data.sub_focus },
    { label: "Tone",      val: data.sub_tone },
    { label: "Narrative", val: data.sub_narrative_contribution },
  ];
  const r = 48; const circ = 2 * Math.PI * r;
  const offset = circ - (data.clarity_score / 100) * circ;
  const col = scoreColor(data.clarity_score);

  return (
    <div className="chat-analysis-card">
      <div className="chat-card-header">
        <span className="chat-card-label">Analyse de Communication</span>
        <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}
          style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
          {data.narrative_risk} Risk
        </span>
      </div>

      {/* Score */}
      <div className="chat-card-score-row">
        <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bg3)" strokeWidth="9" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="9"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset 1s ease" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Lora',serif", fontSize: "1.6rem", fontWeight: 600, color: col, lineHeight: 1 }}>
              {data.clarity_score}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>/100</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-dim)", marginBottom: 6 }}>
            Clarity Score
          </p>
          <div style={{ height: 5, background: "var(--bg3)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${data.clarity_score}%`, background: col, borderRadius: 3, transition: "width 1s ease" }} />
          </div>
          <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}>{data.narrative_risk} Risk</span>
        </div>
      </div>

      {/* Subscores */}
      <div className="chat-card-subscores">
        {subs.map(s => (
          <div key={s.label} className="chat-card-sub">
            <p className="score-label-sm">{s.label}</p>
            <p className={`score-val ${subClass(s.val)}`} style={{ fontSize: 18 }}>{s.val}</p>
            <div className="score-bar-mini">
              <div className="score-bar-fill" style={{ width: `${(s.val / 20) * 100}%`, background: scoreColor(s.val * 5) }} />
            </div>
          </div>
        ))}
      </div>

      {/* Points */}
      <div className="chat-card-sections">
        {data.points_forts?.length > 0 && (
          <div>
            <p className="chat-section-label">Points Forts</p>
            {data.points_forts.map((p, i) => <div key={i} className="rec-item success">{p}</div>)}
          </div>
        )}
        {data.points_faibles?.length > 0 && (
          <div>
            <p className="chat-section-label">Points Faibles</p>
            {data.points_faibles.map((p, i) => <div key={i} className="rec-item warning">{p}</div>)}
          </div>
        )}
        {data.recommandations?.length > 0 && (
          <div>
            <p className="chat-section-label">Recommandations</p>
            {data.recommandations.map((r, i) => <div key={i} className="rec-item info">{r}</div>)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="chat-card-footer">
        <button className="btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }}
          onClick={() => nav(`/analysis/${data.id}`)}>
          Rapport complet →
        </button>
        <button className="btn-primary" style={{ fontSize: 11, padding: "5px 14px" }}
          onClick={() => onRewrite(
            data.message_body || "",
            data.points_faibles || [],
            data.recommandations || []
          )}>
          ✏️ Améliorer ce message
        </button>
      </div>
    </div>
  );
}

/* ── Typing indicator ────────────────────────── */
function TypingIndicator({ label = "Clarity Engine analyse…" }: { label?: string }) {
  return (
    <div className="chat-msg ai">
      <div className="msg-avatar ai">CE</div>
      <div className="msg-bubble ai" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="typing-indicator">
          <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
        </div>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────── */
export default function Analyze() {
  const nav = useNavigate();
  const [messages, setMessages]           = useState<Msg[]>([]);
  const [input, setInput]                 = useState("");
  const [bsId, setBsId]                   = useState<number | "">("");
  const [brandSystems, setBrandSystems]   = useState<BS[]>([]);
  const [loading, setLoading]             = useState(false);
  const [channel, setChannel]             = useState("");
  const [contentType, setContentType]     = useState("");
  const [showMeta, setShowMeta]           = useState(false);
  const [audience, setAudience]           = useState("");
  const [campaign, setCampaign]           = useState("");
  const [title, setTitle]                 = useState("");
  const endRef  = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Track the last analysis result for rewrite context
  const lastResult = [...messages].reverse().find(m => m.type === "result") as
    | Extract<Msg, { type: "result" }>
    | undefined;

  useEffect(() => { getBrandSystems().then(setBrandSystems); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const addMsg = (m: Msg) => setMessages(prev => [...prev, m]);
  const removeTyping = (prev: Msg[]) => prev.filter(m => m.type !== "typing");

  /* ── Trigger rewrite from button in card ── */
  const triggerRewrite = (body: string, faibles: string[], recs: string[]) => {
    setInput("Améliore ce message en appliquant les recommandations");
    textRef.current?.focus();
    // Store context for next send
    textRef.current?.setAttribute("data-rewrite-body", body);
    textRef.current?.setAttribute("data-rewrite-faibles", JSON.stringify(faibles));
    textRef.current?.setAttribute("data-rewrite-recs", JSON.stringify(recs));
  };

  /* ── Trigger re-analyze from rewrite card ── */
  const triggerReanalyze = (body: string) => {
    setInput(body);
    textRef.current?.focus();
  };

  /* ── Send handler ── */
  const handleSend = async () => {
    if (!input.trim() || !bsId || loading) return;
    const text = input.trim();
    setInput("");
    addMsg({ type: "user", text });

    const hasLastResult = !!lastResult;

    // Smart detection: is this a rewrite instruction?
    const explicitRewriteBody = textRef.current?.getAttribute("data-rewrite-body") || "";
    const isRewrite = isRewriteInstruction(text, hasLastResult) || !!explicitRewriteBody;

    // Clear stored rewrite context
    textRef.current?.removeAttribute("data-rewrite-body");
    textRef.current?.removeAttribute("data-rewrite-faibles");
    textRef.current?.removeAttribute("data-rewrite-recs");

    if (isRewrite && lastResult) {
      /* ── Rewrite flow ── */
      setMessages(prev => [...prev, { type: "typing", label: "Réécriture en cours…" }]);
      setLoading(true);
      try {
        const originalBody = explicitRewriteBody || lastResult.data.message_body || "";
        const faibles  = lastResult.data.points_faibles || [];
        const recs     = lastResult.data.recommandations || [];

        const result = await postRewrite({
          brand_system_id:  Number(bsId),
          original_message: originalBody,
          instruction:      text,
          points_faibles:   faibles,
          recommandations:  recs,
        });

        setMessages(prev => [
          ...removeTyping(prev),
          {
            type: "rewrite",
            text: result.rewritten_message,
            changes: result.changes_made || [],
            originalBody,
          },
        ]);
      } catch (err: unknown) {
        setMessages(prev => [
          ...removeTyping(prev),
          { type: "error", text: err instanceof Error ? err.message : "Rewrite failed." },
        ]);
      } finally { setLoading(false); }

    } else {
      /* ── Standard analysis flow ── */
      setMessages(prev => [...prev, { type: "typing", label: "Analyse en cours…" }]);
      setLoading(true);
      try {
        const res = await postAnalyze({
          brand_system_id: bsId,
          message_title:   title || text.slice(0, 60),
          message_body:    text,
          message_language: "fr",
          channel:         channel || null,
          content_type:    contentType || null,
          audience:        audience || null,
          campaign:        campaign || null,
        });
        const full = await getAnalysis(res.id);
        // Attach the original body so rewrite can reference it
        full.message_body = text;
        setMessages(prev => [...removeTyping(prev), { type: "result", data: full }]);
      } catch (err: unknown) {
        setMessages(prev => [
          ...removeTyping(prev),
          { type: "error", text: err instanceof Error ? err.message : "Analysis failed." },
        ]);
      } finally { setLoading(false); }
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const fillSuggestion = (s: string) => { setInput(s); textRef.current?.focus(); };

  /* ── Render ── */
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
            <a key={n.path} href={n.path} className={`nav-item${n.path === "/analyze" ? " active" : ""}`}
              onClick={e => { e.preventDefault(); nav(n.path); }}>
              <span style={{ fontSize: "0.9rem" }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <button className="logout-btn" onClick={() => { logout(); window.location.href = "/login"; }}>
          Sign Out
        </button>
      </aside>

      {/* Chat main */}
      <main className="chat-shell-main">
        {/* Topbar */}
        <div className="chat-topbar">
          <div className="chat-topbar-left">
            <span className="chat-topbar-title">Clarity Engine</span>
            {bsId && brandSystems.find(b => b.id === bsId) && (
              <span className="chat-topbar-chip">
                {brandSystems.find(b => b.id === bsId)!.brand_name}
              </span>
            )}
            {lastResult && (
              <span className="chat-topbar-chip" style={{ background: "var(--accent-dim)", color: "var(--accent)", borderColor: "var(--accent-border)" }}>
                💡 Tapez "améliore" ou "corrige" pour réécrire
              </span>
            )}
          </div>
          {messages.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={() => setMessages([])}>
              Nouvelle session
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="chat-messages">
          <div className="chat-thread">
            {/* Welcome state */}
            {messages.length === 0 && (
              <div className="welcome-state">
                <div className="welcome-logo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
                  </svg>
                </div>
                <h2 className="welcome-title">Clarity Engine</h2>
                <p className="welcome-sub">
                  Collez un message, obtenez une analyse. Puis dites <strong>"améliore-le"</strong> pour le réécrire selon votre Brand System.
                </p>
                {brandSystems.length === 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <a href="/brand-system/new" className="btn-primary"
                      onClick={e => { e.preventDefault(); nav("/brand-system/new"); }}>
                      Créer un Brand System →
                    </a>
                  </div>
                )}
                <div className="suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="suggestion-pill" onClick={() => fillSuggestion(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Thread */}
            {messages.map((msg, i) => {
              if (msg.type === "typing") return <TypingIndicator key={i} label={msg.label} />;
              if (msg.type === "user") return (
                <div key={i} className="chat-msg user">
                  <div className="msg-avatar user-av">U</div>
                  <div className="msg-bubble user">{msg.text}</div>
                </div>
              );
              if (msg.type === "error") return (
                <div key={i} className="chat-msg ai">
                  <div className="msg-avatar ai">CE</div>
                  <div className="msg-bubble ai" style={{ color: "var(--danger)" }}>❌ {msg.text}</div>
                </div>
              );
              if (msg.type === "result") return (
                <div key={i} className="chat-msg ai">
                  <div className="msg-avatar ai">CE</div>
                  <AnalysisCard data={msg.data} nav={nav}
                    onRewrite={(body, faibles, recs) => triggerRewrite(body, faibles, recs)} />
                </div>
              );
              if (msg.type === "rewrite") return (
                <div key={i} className="chat-msg ai">
                  <div className="msg-avatar ai">CE</div>
                  <RewriteCard text={msg.text} changes={msg.changes}
                    originalBody={msg.originalBody}
                    onReanalyze={triggerReanalyze} />
                </div>
              );
              return null;
            })}
            <div ref={endRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <div className="chat-controls">
              <select className="chat-select" value={bsId} onChange={e => setBsId(Number(e.target.value) || "")}>
                <option value="">— Sélectionner un Brand System —</option>
                {brandSystems.map(bs => (
                  <option key={bs.id} value={bs.id}>{bs.brand_name} (v{bs.version})</option>
                ))}
              </select>
              <select className="chat-select" value={contentType} onChange={e => setContentType(e.target.value)}>
                <option value="">Type de contenu</option>
                {["Communication", "Article", "Speech", "Email", "Press Release", "Post LinkedIn", "Report"].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select className="chat-select" value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="">Canal</option>
                {["Email", "LinkedIn", "Press Release", "Website", "Internal", "Social Media"].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <button className="meta-toggle-btn" onClick={() => setShowMeta(v => !v)}>
                {showMeta ? "Masquer" : "+ Contexte"}
              </button>
            </div>

            {showMeta && (
              <div className="chat-meta-row">
                <input className="meta-input" placeholder="Titre du message" value={title} onChange={e => setTitle(e.target.value)} />
                <input className="meta-input" placeholder="Audience cible" value={audience} onChange={e => setAudience(e.target.value)} />
                <input className="meta-input" placeholder="Campagne" value={campaign} onChange={e => setCampaign(e.target.value)} />
              </div>
            )}

            <div className="chat-input-box">
              <textarea
                ref={textRef}
                rows={1}
                placeholder={
                  !bsId ? "Sélectionnez d'abord un Brand System…" :
                  lastResult ? "Collez un nouveau message — ou tapez « améliore-le », « corrige le ton »…" :
                  "Collez votre message de communication ici… (Entrée pour envoyer)"
                }
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={onKey}
                disabled={!bsId || loading}
              />
              <button className="send-btn" id="send-btn"
                onClick={handleSend} disabled={!bsId || !input.trim() || loading}>
                {loading
                  ? <span className="spinner spinner-sm" style={{ borderTopColor: "#fff" }} />
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                }
              </button>
            </div>
            <p className="input-hint">
              {lastResult
                ? "💡 Tapez « améliore-le », « corrige le ton » ou « rends-le plus court » pour réécrire · Shift+Entrée pour nouvelle ligne"
                : "Shift+Entrée pour nouvelle ligne · Entrée pour envoyer"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
