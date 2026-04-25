import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAnalysis } from "../services/brandSystems";

interface AnalysisData {
  id:number; message_title:string; brand_system_name:string;
  message_language:string; channel:string; content_type:string;
  clarity_score:number; sub_clarity:number; sub_alignment:number;
  sub_focus:number; sub_tone:number; sub_narrative_contribution:number;
  narrative_risk:"Low"|"Medium"|"High";
  points_forts:string[]; points_faibles:string[]; recommandations:string[];
  analyzed_at:string;
}

const RISK_CLASS = {Low:"risk-low", Medium:"risk-medium", High:"risk-high"};
const scoreClass = (n:number, max:number) => {
  const p = n/max; return p>=0.75?"good":p>=0.5?"warn":"bad";
};
const barColor = (n:number, max:number) => {
  const p = n/max;
  return p>=0.75?"#2e7d5e":p>=0.5?"#b07d28":"#c0392b";
};

export default function AnalysisResult() {
  const {id} = useParams<{id:string}>();
  const nav = useNavigate();
  const [data, setData]       = useState<AnalysisData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!id) return;
    getAnalysis(id).then(setData).catch(()=>setError("Analysis not found")).finally(()=>setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading"><span className="spinner spinner-lg"/> Loading…</div>;
  if (!data)   return (
    <div style={{padding:40}}>
      <div className="empty-cta">
        <p>{error}</p>
        <a href="/analyze" className="btn-primary">New Analysis →</a>
      </div>
    </div>
  );

  const subs = [
    {label:"Clarity",              val:data.sub_clarity},
    {label:"Alignment",            val:data.sub_alignment},
    {label:"Focus",                val:data.sub_focus},
    {label:"Tone",                 val:data.sub_tone},
    {label:"Narrative",            val:data.sub_narrative_contribution},
  ];

  const scoreNum = data.clarity_score;
  const r = 72; const circ = 2*Math.PI*r;
  const offset = circ - (scoreNum/100)*circ;
  const ringColor = scoreNum>=75?"#2e7d5e":scoreNum>=50?"#b07d28":"#c0392b";

  return (
    <div style={{minHeight:"100vh", background:"var(--bg)", padding:"28px"}}>
      <div style={{maxWidth:860, margin:"0 auto"}}>

        {/* Header */}
        <div className="page-header no-print">
          <div>
            <h1 className="page-title">{data.message_title}</h1>
            <p className="page-sub">{data.brand_system_name} · {data.analyzed_at?.slice(0,10)}</p>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" onClick={()=>window.print()}>🖨 Export PDF</button>
            <a href="/analyze" className="btn-primary" onClick={e=>{e.preventDefault();nav("/analyze")}}>
              + Nouvelle analyse
            </a>
          </div>
        </div>

        {/* Analysis card — matches mockup */}
        <div className="result-card" style={{padding:0, overflow:"hidden"}}>

          {/* Card header */}
          <div style={{
            padding:"14px 18px", display:"flex", alignItems:"center",
            justifyContent:"space-between",
            background:"linear-gradient(135deg, #fdd335 0%, #2a5298 100%)"
          }}>
            <span style={{fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.8)", textTransform:"uppercase", letterSpacing:"0.5px"}}>
              Analyse de Communication
            </span>
            <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}
              style={{background:"rgba(255,255,255,0.18)", color:"#fff", borderColor:"rgba(255,255,255,0.3)"}}>
              {data.narrative_risk} Risk
            </span>
          </div>

          {/* Score + ring */}
          <div style={{padding:"20px 20px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:20}}>
            {/* SVG ring */}
            <div className="score-ring-wrap" style={{width:176, height:176}}>
              <svg width="176" height="176" viewBox="0 0 176 176">
                <circle cx="88" cy="88" r={r} fill="none" stroke="var(--bg3)" strokeWidth="12"/>
                <circle cx="88" cy="88" r={r} fill="none" stroke={ringColor} strokeWidth="12"
                  strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                  transform="rotate(-90 88 88)" style={{transition:"stroke-dashoffset 1s ease"}}/>
              </svg>
              <div className="score-ring-text">
                <span className="score-number" style={{color:ringColor, fontFamily:"'Lora',serif", fontSize:"2.2rem", fontWeight:600}}>{scoreNum}</span>
                <span className="score-denom">/100</span>
              </div>
            </div>

            <div style={{flex:1}}>
              <p style={{fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", color:"var(--text-dim)", marginBottom:6}}>
                Clarity Score Global
              </p>
              <div style={{height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden", marginBottom:8}}>
                <div style={{height:"100%", width:`${scoreNum}%`, background:ringColor, borderRadius:3, transition:"width 1s ease"}}/>
              </div>
              <span className={`risk-badge ${RISK_CLASS[data.narrative_risk]}`}>{data.narrative_risk} Risk</span>
            </div>
          </div>

          {/* 5 subscores grid */}
          <div className="analysis-scores">
            {subs.map(s => (
              <div key={s.label} className="score-cell">
                <p className="score-label-sm">{s.label}</p>
                <p className={`score-val ${scoreClass(s.val,20)}`}>{s.val}</p>
                <div className="score-bar-mini">
                  <div className="score-bar-fill" style={{width:`${(s.val/20)*100}%`, background:barColor(s.val,20)}}/>
                </div>
              </div>
            ))}
          </div>

          {/* Points forts / faibles / recommandations */}
          <div style={{padding:"16px 18px", display:"flex", flexDirection:"column", gap:10}}>
            {data.points_forts?.length > 0 && (
              <div>
                <p style={{fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-dim)", marginBottom:8}}>
                  Points Forts
                </p>
                {data.points_forts.map((p,i) => (
                  <div key={i} style={{padding:"10px 14px", borderRadius:"var(--radius-xs)", fontSize:13, lineHeight:1.6, color:"var(--text-muted)", background:"rgba(46,125,94,0.06)", borderLeft:"2.5px solid #2e7d5e", marginBottom:6}}>
                    {p}
                  </div>
                ))}
              </div>
            )}

            {data.points_faibles?.length > 0 && (
              <div>
                <p style={{fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-dim)", marginBottom:8}}>
                  Points Faibles
                </p>
                {data.points_faibles.map((p,i) => (
                  <div key={i} style={{padding:"10px 14px", borderRadius:"var(--radius-xs)", fontSize:13, lineHeight:1.6, color:"var(--text-muted)", background:"rgba(176,125,40,0.06)", borderLeft:"2.5px solid #b07d28", marginBottom:6}}>
                    {p}
                  </div>
                ))}
              </div>
            )}

            {data.recommandations?.length > 0 && (
              <div>
                <p style={{fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-dim)", marginBottom:8}}>
                  Recommandations
                </p>
                {data.recommandations.map((r,i) => (
                  <div key={i} style={{padding:"10px 14px", borderRadius:"var(--radius-xs)", fontSize:13, lineHeight:1.6, color:"var(--text-muted)", background:"var(--accent-dim)", borderLeft:"2.5px solid var(--accent)", marginBottom:6}}>
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meta strip */}
          <div style={{display:"flex", gap:14, padding:"10px 18px", background:"var(--bg3)", borderTop:"1px solid var(--border)", flexWrap:"wrap"}}>
            {[
              {label:"Brand System", val:data.brand_system_name},
              {label:"Language",     val:data.message_language?.toUpperCase()},
              {label:"Channel",      val:data.channel || "—"},
              {label:"Type",         val:data.content_type || "—"},
              {label:"Analyzed",     val:data.analyzed_at?.slice(0,10)},
            ].map(m => (
              <span key={m.label} style={{fontSize:11, color:"var(--text-dim)", display:"flex", gap:4, alignItems:"center"}}>
                {m.label}: <strong style={{color:"var(--text-muted)", fontWeight:500}}>{m.val}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="result-footer no-print" style={{marginTop:16}}>
          <a href="/history" className="btn-ghost" onClick={e=>{e.preventDefault();nav("/history")}}>← Historique</a>
          <a href="/analyze" className="btn-primary" onClick={e=>{e.preventDefault();nav("/analyze")}}>+ Nouvelle analyse</a>
        </div>
      </div>
    </div>
  );
}
