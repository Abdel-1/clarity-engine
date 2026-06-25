import { useState } from "react";

/* ── InfoTip ───────────────────────────────────────────────────────────
   A small circled "i" that reveals a short French explanation on hover.
   Used to document what each KPI / dashboard panel measures. Renders the
   tooltip with explicit non-uppercase / normal-weight typography so it stays
   readable even inside the uppercase, letter-spaced section titles. */
export default function InfoTip({ text, align = "left" }: {
  text: string;
  /** How the tooltip is anchored to the icon: extend right ("left"), extend
      left ("right"), or sit centered above it ("center"). */
  align?: "left" | "right" | "center";
}) {
  const [hovered, setHovered] = useState(false);
  const posStyle: React.CSSProperties =
    align === "center" ? { left: "50%", transform: "translateX(-50%)" }
    : align === "right" ? { right: 0 }
    : { left: 0 };
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 7, verticalAlign: "middle", cursor: "help" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        aria-hidden
        style={{
          width: 14, height: 14, borderRadius: "50%",
          border: "1px solid var(--text-dim)", color: "var(--text-dim)",
          fontSize: 9, fontWeight: 700, fontStyle: "italic", lineHeight: 1,
          textTransform: "none", letterSpacing: "normal",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >i</span>
      <span
        role="tooltip"
        style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          ...posStyle,
          background: "#0f2744",
          color: "#fff",
          fontSize: 11,
          fontWeight: 400,
          fontStyle: "normal",
          letterSpacing: "normal",
          textTransform: "none",
          lineHeight: 1.5,
          padding: "8px 12px",
          borderRadius: 8,
          width: 240,
          textAlign: "left",
          pointerEvents: "none",
          zIndex: 100,
          boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.18s ease",
        }}
      >{text}</span>
    </span>
  );
}
