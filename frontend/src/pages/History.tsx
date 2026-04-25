import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalyses } from "../services/brandSystems";

interface Row {
  id: number; message_title: string; brand_system_name: string;
  content_type: string; channel: string; clarity_score: number;
  narrative_risk: "Low"|"Medium"|"High"; analyzed_at: string;
}

const RISK_CLASS = { Low: "risk-low", Medium: "risk-medium", High: "risk-high" };

export default function History() {
  const nav = useNavigate();
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [risk, setRisk]       = useState("");
  const [channel, setChannel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");

  const load = async () => {
    setLoading(true);
    const f: Record<string, string> = {};
    if (risk)     f.risk     = risk;
    if (channel)  f.channel  = channel;
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo)   f.date_to   = dateTo;
    const data = await getAnalyses(f);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analysis History</h1>
          <p className="page-sub">All brand governance evaluations</p>
        </div>
        <a href="/analyze" className="btn-primary">+ Nouvelle analyse</a>
      </div>

      {/* Filters */}
      <div className="filter-bar">
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
        <input className="filter-input" type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)} />
        <button className="btn-primary" onClick={load}>Filter</button>
      </div>

      {loading ? (
        <div className="page-loading"><span className="spinner" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-cta">
          <p>No analyses found.</p>
          <a href="/analyze" className="btn-primary">Run your first analysis →</a>
        </div>
      ) : (
        <div className="table-card">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Date</th><th>Title</th><th>Brand System</th>
                <th>Type</th><th>Score</th><th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="table-row-clickable"
                  onClick={() => nav(`/analysis/${r.id}`)} id={`analysis-row-${r.id}`}>
                  <td className="td-muted">{r.analyzed_at?.slice(0, 10)}</td>
                  <td className="td-bold">{r.message_title}</td>
                  <td>{r.brand_system_name}</td>
                  <td className="td-muted">{r.content_type || "—"}</td>
                  <td>
                    <span className={`score-pill ${r.clarity_score >= 75 ? "score-green" : r.clarity_score >= 50 ? "score-amber" : "score-red"}`}>
                      {r.clarity_score}
                    </span>
                  </td>
                  <td>
                    <span className={`risk-badge ${RISK_CLASS[r.narrative_risk]}`}>
                      {r.narrative_risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
