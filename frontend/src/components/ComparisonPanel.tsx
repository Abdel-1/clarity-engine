/* ── Generic head-to-head comparison panel ────────────────────────────
   Compares N entities (team members, brand systems, …) across a shared
   set of numeric metrics: bullet bars highlighting whoever wins each
   row, plus an overall "champion" callout. Used by the brand admin's
   member comparison and the global admin's brand-system comparison. */

export interface CompareMetric {
  key: string;
  label: string;
  higherIsBetter: boolean;
  format?: (v: number) => string;
}

export interface CompareEntity {
  key: string;
  name: string;
  sublabel?: string;
  metrics: Record<string, number>;
}

const hashColor = (name: string) => `hsl(${(name.charCodeAt(0) * 37) % 360}, 55%, 45%)`;

function EntityChip({ entity, onRemove }: { entity: CompareEntity; onRemove: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, minWidth: 0,
      background: "var(--bg3)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "8px 10px",
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff", background: hashColor(entity.name),
      }}>
        {entity.name.slice(0, 1).toUpperCase()}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entity.name}
        </div>
        {entity.sublabel && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entity.sublabel}
          </div>
        )}
      </div>
      <button onClick={onRemove} title="Retirer de la comparaison" style={{
        background: "none", border: "none", color: "var(--text-dim)",
        cursor: "pointer", fontSize: 13, padding: 2, flexShrink: 0,
      }}>
        ✕
      </button>
    </div>
  );
}

export default function ComparisonPanel({
  title, subtitle, accentColor, entities, metrics, onRemove, onClose,
}: {
  title: string;
  subtitle?: string;
  accentColor: string;
  entities: CompareEntity[];
  metrics: CompareMetric[];
  onRemove: (key: string) => void;
  onClose: () => void;
}) {
  /* Per-metric winner — skipped when every entity ties (no signal) */
  const bestKeyFor = (m: CompareMetric): string | null => {
    const values = entities.map(e => e.metrics[m.key] ?? 0);
    const best  = m.higherIsBetter ? Math.max(...values) : Math.min(...values);
    const worst = m.higherIsBetter ? Math.min(...values) : Math.max(...values);
    if (best === worst) return null;
    const winners = entities.filter(e => (e.metrics[m.key] ?? 0) === best);
    return winners.length === 1 ? winners[0].key : null;
  };

  const wins: Record<string, number> = {};
  entities.forEach(e => { wins[e.key] = 0; });
  metrics.forEach(m => {
    const w = bestKeyFor(m);
    if (w) wins[w] += 1;
  });
  const topWins = Math.max(...entities.map(e => wins[e.key]));
  const champions = entities.filter(e => topWins > 0 && wins[e.key] === topWins);

  return (
    <div style={{
      background: "var(--bg2)", border: `1px solid ${accentColor}33`, borderRadius: 16,
      padding: "20px 22px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
            ⇄ {title}
          </p>
          {subtitle && <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
          ✕ Fermer
        </button>
      </div>

      {/* Entity chips, aligned with the metric columns below */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 160, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {entities.map(e => (
            <div key={e.key} style={{ flex: "1 1 160px", minWidth: 140 }}>
              <EntityChip entity={e} onRemove={() => onRemove(e.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* One row per metric — bullet bar + crown for the winner */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {metrics.map(m => {
          const values = entities.map(e => e.metrics[m.key] ?? 0);
          const maxValue = Math.max(...values, 0.0001);
          const winnerKey = bestKeyFor(m);
          return (
            <div key={m.key} style={{ display: "flex", gap: 14 }}>
              <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: "var(--text-dim)", fontWeight: 600, alignSelf: "center" }}>
                {m.label}
              </div>
              <div style={{ flex: 1, display: "flex", gap: 14, flexWrap: "wrap" }}>
                {entities.map(e => {
                  const v = e.metrics[m.key] ?? 0;
                  const pct = Math.max(4, (v / maxValue) * 100);
                  const isWinner = winnerKey === e.key;
                  return (
                    <div key={e.key} style={{ flex: "1 1 160px", minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: isWinner ? accentColor : "var(--text)" }}>
                          {m.format ? m.format(v) : v}
                        </span>
                      </div>
                      <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, borderRadius: 3,
                          background: isWinner ? accentColor : "var(--text-dim)",
                          opacity: isWinner ? 1 : 0.45,
                          transition: "width .5s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall verdict */}
      <div style={{
        marginTop: 18, padding: "12px 16px", borderRadius: 12,
        background: champions.length === 1 ? `${accentColor}14` : "var(--bg3)",
        border: `1px solid ${champions.length === 1 ? `${accentColor}33` : "var(--border)"}`,
        fontSize: 12.5, color: "var(--text)",
      }}>
        {champions.length === 1
          ? <><strong style={{ color: accentColor }}>{champions[0].name}</strong> devance sur {topWins}/{metrics.length} indicateur{topWins > 1 ? "s" : ""} comparé{topWins > 1 ? "s" : ""}.</>
          : <>Comparaison équilibrée — aucune entrée ne domine sur l'ensemble des indicateurs.</>}
      </div>
    </div>
  );
}
