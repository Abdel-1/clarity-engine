"""
calibration/run.py — generic CLI runner for the brand-agnostic calibration harness.

Examples:
    python -m calibration.run mg                      # MG band report (3 runs/case)
    python -m calibration.run mg --runs 1             # quick single-pass
    python -m calibration.run mg --stability          # + repeatability/paraphrase/contrast/cross-brand
    python -m calibration.run technopark              # Technopark regression
    python -m calibration.run mg --from-db            # load brand system from DB by id

The harness is identical for every brand: pass any registered fixture name.
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DEEPSEEK_TIMEOUT", os.environ.get("CALIB_TIMEOUT", "180"))

from calibration import harness as H            # noqa: E402
from calibration.fixtures import get as get_fixture, technopark as _tp  # noqa: E402

# Generic neutral, SOBER probe for the cross-brand decoupling check. Tonally
# understated (no warmth, no hype) — should read on-tone for an understated brand
# and flatter for a warm/energetic one. Not specific to any brand.
CROSS_BRAND_PROBE = {
    "message": "Nous préférons la sobriété à l'esbroufe : des faits, des preuves, et rien de superflu.",
    "meta": {"canal": "Site web", "audience": "Grand public",
             "objectif": "Affirmer la posture", "type": "Message de marque", "titre": "Cross-brand probe"},
}


def main():
    ap = argparse.ArgumentParser(description="Brand-agnostic calibration runner")
    ap.add_argument("brand", help="fixture name (mg | technopark | …)")
    ap.add_argument("--runs", type=int, default=3, help="runs per case (default 3)")
    ap.add_argument("--stability", action="store_true", help="add repeatability/paraphrase/contrast/cross-brand/metadata")
    ap.add_argument("--metadata", action="store_true", help="run ONLY the metadata-sensitivity test (same message, different canal/audience)")
    ap.add_argument("--from-db", action="store_true", help="load brand system from DB by BRAND_SYSTEM_ID")
    ap.add_argument("--out", default=None, help="report file (default ~/Desktop/calibration_<brand>_result.txt)")
    args = ap.parse_args()

    fx = get_fixture(args.brand)
    bs, source = H.resolve_brand_system(fx, args.from_db)

    out = Path(args.out) if args.out else Path.home() / "Desktop" / f"calibration_{fx.BRAND.lower().replace(' ', '_')}_result.txt"
    lines = [f"Brand system source : {source}  ·  runs/case = {args.runs}"]

    # ── Metadata-only mode (cheap focused test) ───────────────────────────
    if args.metadata:
        if not getattr(fx, "CHANNEL_TESTS", None):
            raise SystemExit(f"[run] {fx.BRAND} n'a pas de CHANNEL_TESTS.")
        md_lines, md_ok = H.channel_sensitivity(bs, fx.CHANNEL_TESTS(), dump_payload_for="A)")
        lines += md_lines
        lines += H.scorecard([("Sensibilité métadonnées (canal/audience)", md_ok)])
        report = "\n".join(lines)
        out.write_text(report, encoding="utf-8"); print(report)
        sys.exit(0 if md_ok else 1)

    # ── Band report ───────────────────────────────────────────────────────
    results, latencies = H.run_suite(bs, fx.CASES, args.runs)
    band_lines, band_ok = H.band_table(fx.BRAND, fx.CASES, results)
    lines += band_lines

    score_rows = [(f"Bande (20 cas) — {fx.BRAND}", band_ok)]

    # ── Stability / coherence (optional, single report) ───────────────────
    if args.stability:
        rep_lines, rep_ok = H.repeatability(fx.BRAND, fx.CASES, results, getattr(fx, "REPEATABILITY_IDS", []), args.runs)
        lines += rep_lines
        score_rows.append(("Répétabilité (spread ≤ 1, risk stable)", rep_ok))

        if getattr(fx, "PARAPHRASES", None):
            par_lines, par_ok = H.paraphrase(bs, fx.PARAPHRASES, args.runs)
            lines += par_lines
            score_rows.append(("Robustesse paraphrase (global ±8)", par_ok))

        if getattr(fx, "CONTRAST_CHECKS", None):
            con_lines, con_ok = H.contrast(fx.CONTRAST_CHECKS, results)
            lines += con_lines
            score_rows.append(("Paires de contraste (sens des écarts)", con_ok))

        # Cross-brand: evaluate the same probe against this brand + a different one.
        other = _tp if fx is not _tp else get_fixture("mg")
        cb_lines, cb_ok = H.cross_brand(
            [(fx.BRAND, bs), (other.BRAND, other.BRAND_SYSTEM)],
            CROSS_BRAND_PROBE["message"], CROSS_BRAND_PROBE["meta"],
        )
        lines += cb_lines
        score_rows.append((f"Cross-brand ({fx.BRAND} ≠ {other.BRAND})", cb_ok))

        if getattr(fx, "CHANNEL_TESTS", None):
            md_lines, md_ok = H.channel_sensitivity(bs, fx.CHANNEL_TESTS(), dump_payload_for="A)")
            lines += md_lines
            score_rows.append(("Sensibilité métadonnées (canal/audience)", md_ok))

    lines += H.latency_block(latencies)
    lines += H.scorecard(score_rows)

    report = "\n".join(lines)
    out.write_text(report, encoding="utf-8")
    print(report)
    sys.stderr.write(f"\nReport written to: {out}\n")

    all_pass = all(ok for _, ok in score_rows if ok is not None)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
