/* ── Analysis-volume-over-time chart ──────────────────────────────────
   Buckets a flat list of analyses by day / week / month / year and draws a
   simple bar chart of how many were produced per period. Supports a custom
   date range and an optional series filter (member or brand system). Shared
   by the brand admin dashboard (filter by member) and the global admin
   dashboard (filter by brand system). */
import { useState } from "react";
import InfoTip from "./InfoTip";
import Select from "./Select";

export interface TimelineItem {
  analyzed_at: string | null;
  /** The dimension the chart can be filtered/split by (member name or brand). */
  series: string | null;
}

export type Granularity = "day" | "week" | "month" | "year";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day",   label: "Jour" },
  { key: "week",  label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year",  label: "Année" },
];

export function bucketKey(date: Date, g: Granularity): string {
  const iso = date.toISOString();
  if (g === "day")   return iso.slice(0, 10);
  if (g === "month") return iso.slice(0, 7);
  if (g === "year")  return iso.slice(0, 4);
  // week — Sunday-based week number, grouped per calendar year
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((days + jan1.getUTCDay()) / 7);
  return `${year}-S${String(week).padStart(2, "0")}`;
}

function bucketLabel(key: string, g: Granularity): string {
  if (g === "year") return key;
  if (g === "week") return key.slice(5);   // "S23"
  return key.slice(5);                      // "MM-DD" or "MM"
}

function GranularityToggle({ value, onChange, accentColor }: {
  value: Granularity; onChange: (g: Granularity) => void; accentColor: string;
}) {
  return (
    <div style={{ display: "flex", gap: 3, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 3 }}>
      {GRANULARITIES.map(g => (
        <button
          key={g.key}
          onClick={() => onChange(g.key)}
          style={{
            fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            background: value === g.key ? accentColor : "transparent",
            color: value === g.key ? "#0a0a0a" : "var(--text-dim)",
          }}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

export default function TimelineVolumeChart({
  title, items, seriesLabel, accentColor, barColor, infoText,
}: {
  title: string;
  items: TimelineItem[];
  /** Label shown on the "all series" dropdown option, e.g. "Tous les membres". */
  seriesLabel: string;
  accentColor: string;
  barColor: string;
  /** Optional French explanation shown as a hover tooltip next to the title. */
  infoText?: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [series, setSeries] = useState("");   // "" = all series
  const [from, setFrom] = useState("");        // custom range lower bound
  const [to, setTo] = useState("");            // custom range upper bound

  const seriesOptions = Array.from(
    new Set(items.map(i => i.series).filter((n): n is string => !!n))
  ).sort();

  const hasCustomRange = !!(from || to);
  const filtered = items.filter(i => {
    if (series && i.series !== series) return false;
    if (!i.analyzed_at) return false;
    const day = i.analyzed_at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  const buckets = (() => {
    const counts = new Map<string, number>();
    for (const i of filtered) {
      const key = bucketKey(new Date(i.analyzed_at as string), granularity);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(hasCustomRange ? -60 : -12);
  })();
  const maxCount = Math.max(...buckets.map(([, c]) => c), 1);

  const dateInputStyle: React.CSSProperties = {
    width: "auto", background: "var(--bg)", color: "var(--text)",
    border: "1px solid var(--border)", borderRadius: 8,
    padding: "5px 8px", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
  };

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 }}>
          {title}
          {infoText && <InfoTip text={infoText} />}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {seriesOptions.length > 0 && (
            <Select
              value={series}
              onChange={setSeries}
              placeholder={seriesLabel}
              ariaLabel={seriesLabel}
              options={seriesOptions.map(o => ({ value: o, label: o }))}
              style={{ maxWidth: 220 }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={from} max={to || undefined} title="Du"
              onChange={e => setFrom(e.target.value)} style={dateInputStyle} />
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>→</span>
            <input type="date" value={to} min={from || undefined} title="Au"
              onChange={e => setTo(e.target.value)} style={dateInputStyle} />
            {hasCustomRange && (
              <button onClick={() => { setFrom(""); setTo(""); }} title="Réinitialiser la période"
                style={dateInputStyle}>↺</button>
            )}
          </div>
          <GranularityToggle value={granularity} onChange={setGranularity} accentColor={accentColor} />
        </div>
      </div>
      {buckets.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 12, padding: 20 }}>Pas encore de données</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
          {buckets.map(([key, count]) => (
            <div key={key} title={`${count} analyse${count > 1 ? "s" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text)" }}>{count}</span>
              <div style={{
                width: "100%", height: Math.max(8, (count / maxCount) * 60),
                background: `linear-gradient(180deg, ${barColor}, ${barColor}66)`,
                borderRadius: 4, transition: "height 0.5s",
              }} />
              <span style={{ fontSize: 8, color: "var(--text-dim)" }}>{bucketLabel(key, granularity)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
