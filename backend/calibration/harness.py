"""
calibration/harness.py — GENERIC, brand-agnostic calibration engine.

Contains NO brand-specific value. Every brand is just data (a fixture module
exposing BRAND, BRAND_SYSTEM, BRAND_SYSTEM_ID, CASES, …). The harness drives the
exact same analyze() service the production API uses, so a passing suite proves
the engine scores *from the brand system fields*, not from hard-coded logic.

Public surface used by calibration/run.py:
    resolve_brand_system(fixture, from_db)        -> (bs_dict, source_str)
    run_suite(bs, cases, runs)                    -> {id: [result, …]}
    band_table(brand, cases, results)             -> (lines, all_ok)
    repeatability(brand, cases, results, ids)     -> (lines, ok)
    contrast(contrast_fn, results)                -> (lines, ok)
    paraphrase(bs, paraphrases, runs)             -> (lines, ok)
    cross_brand(pair, message, meta)              -> (lines, ok)
    scorecard(rows)                               -> lines
"""
import sys
import time

from app.services.brand_analysis_service import analyze

# Target-key (prompt schema) → result-key (flat DB column). Brand-independent.
SUB_MAP = {
    "clarity": "sub_lisibilite",
    "alignment": "sub_alignment",
    "focus": "sub_focus",
    "tone": "sub_tone",
    "narrative_contribution": "sub_narrative_contribution",
}
_SHORT = {"clarity": "Cla", "alignment": "Ali", "focus": "Foc", "tone": "Ton", "narrative_contribution": "Nar"}

# Tolerance (per calibration spec): Δglobal ≤ 8, Δsub ≤ 3, narrative_risk exact.
TOL_GLOBAL = 8
TOL_SUB = 3


# ─────────────────────────────────────────────────────────────────────────────
# Brand-system resolution
# ─────────────────────────────────────────────────────────────────────────────
def resolve_brand_system(fixture, from_db: bool):
    """
    Return (brand_system_dict, source_label).

    from_db=True loads the brand system row by fixture.BRAND_SYSTEM_ID through the
    SAME _bs_row_to_v1 mapping the production /analyze route uses (proves the DB
    path is brand-agnostic). Otherwise uses the in-fixture BRAND_SYSTEM dict.
    """
    if from_db:
        from app.db.session import SessionLocal
        from app.db.models.brand_system import BrandSystem
        from app.api.routes.analysis import _bs_row_to_v1
        db = SessionLocal()
        try:
            row = db.query(BrandSystem).filter(BrandSystem.id == fixture.BRAND_SYSTEM_ID).first()
            if not row:
                raise SystemExit(
                    f"[harness] brand_system_id={fixture.BRAND_SYSTEM_ID} introuvable en base. "
                    f"Seed-le d'abord (ex. python -m calibration.seed_mg_maroc)."
                )
            return _bs_row_to_v1(row), f"DB row id={fixture.BRAND_SYSTEM_ID}"
        finally:
            db.close()
    return fixture.BRAND_SYSTEM, "fixture dict"


# ─────────────────────────────────────────────────────────────────────────────
# Running
# ─────────────────────────────────────────────────────────────────────────────
def _analyze_message(bs, message, meta):
    return analyze(
        bs,
        {"titre": meta.get("titre", "Calibration"), "langue": meta.get("langue", "fr"), "corps": message},
        {"canal": meta.get("canal"), "audience": meta.get("audience"), "objectif": meta.get("objectif"),
         "type_prise_parole": meta.get("type"), "date": None, "auteur": "calibration"},
    )


# Sentinel for a case whose LLM call failed validation twice — keeps the suite
# running instead of aborting the whole batch on one flaky response.
def _error_result(reason):
    r = {dk: 0 for dk in SUB_MAP.values()}
    r.update({"clarity_score": 0, "narrative_risk": "High", "_error": reason})
    return r


def run_suite(bs, cases, runs):
    """Run every case `runs` times. Returns {case_id: [result, …]} and a flat latency list.

    A per-case failure is recorded as an error sentinel (never aborts the batch)."""
    results, latencies = {}, []
    for case in cases:
        runs_out = []
        for i in range(runs):
            sys.stderr.write(f"  [{case['id']}] run {i + 1}/{runs} …\n"); sys.stderr.flush()
            t0 = time.perf_counter()
            try:
                runs_out.append(_analyze_message(bs, case["message"], case))
            except Exception as exc:  # noqa: BLE001 — calibration must survive one bad response
                sys.stderr.write(f"  [{case['id']}] ERREUR: {exc}\n"); sys.stderr.flush()
                runs_out.append(_error_result(str(exc)))
            latencies.append(time.perf_counter() - t0)
        results[case["id"]] = runs_out
    return results, latencies


# ─────────────────────────────────────────────────────────────────────────────
# Assertions / reports
# ─────────────────────────────────────────────────────────────────────────────
def primary(runs_out):
    """The run used for the band table: first successful run, else the first."""
    for r in runs_out:
        if not r.get("_error"):
            return r
    return runs_out[0]


def in_band(case, res):
    if abs(res["clarity_score"] - case["global"]) > TOL_GLOBAL:
        return False
    if res["narrative_risk"] != case["risk"]:
        return False
    for sk, dk in SUB_MAP.items():
        if abs(res[dk] - case["sub"][sk]) > TOL_SUB:
            return False
    # Schema invariant: clarity_score == sum of the 5 sub-scores.
    if res["clarity_score"] != sum(res[dk] for dk in SUB_MAP.values()):
        return False
    return True


def band_table(brand, cases, results):
    col_subs = "  ".join(f"{_SHORT[k]}(T→O)" for k in SUB_MAP)
    L = [
        f"\n{'':=<142}",
        f"  RAPPORT DE CALIBRATION — {brand}  ({len(cases)} cas · Δglobal ≤ {TOL_GLOBAL}, Δsub ≤ {TOL_SUB}, risk exact)",
        f"  Brand-agnostic : analyze() reçoit le brand system de {brand} ; aucune logique de marque codée en dur.",
        f"{'':=<142}",
        f"{'ID':>2}  {'G_cib':>5}  {'G_obt':>5}  {'ΔG':>4}  {'Risk_cib':>9}  {'Risk_obt':>9}  {col_subs}  {'STATUT':>10}",
        f"{'':─<142}",
    ]
    all_ok = True
    for case in cases:
        res = primary(results[case["id"]])
        g_t, g_o = case["global"], res["clarity_score"]
        rt, ro = case["risk"], res["narrative_risk"]
        subs = []
        for sk, dk in SUB_MAP.items():
            t, o = case["sub"][sk], res[dk]
            subs.append(f"{t:>2}→{o:<2}{'' if abs(o - t) <= TOL_SUB else '!'}")
        ok = in_band(case, res)
        all_ok = all_ok and ok
        L.append(f"{case['id']:>2}  {g_t:>5}  {g_o:>5}  {g_o - g_t:>+4}  {rt:>9}  {ro:>9}"
                 f"{'' if ro == rt else '!'}  {'  '.join(subs)}  {'OK' if ok else 'HORS BANDE':>10}")
    L.append(f"{'':═<142}")
    L.append(f"  {'TOUS LES CAS DANS LA BANDE ✓' if all_ok else 'CERTAINS CAS HORS BANDE'}")
    L.append(f"{'':=<142}")
    return L, all_ok


def repeatability(brand, cases, results, ids, runs):
    by_id = {c["id"]: c for c in cases}
    L = [f"\nRÉPÉTABILITÉ — {brand} ({len(ids)} cas variés ×{runs}, spread ≤ 1 par sous-score, risk identique) :"]
    ok_all = True
    for cid in ids:
        runs_out = results.get(cid)
        if not runs_out:
            L.append(f"  [{cid}] absent des résultats — ignoré"); continue
        fails = []
        for sk, dk in SUB_MAP.items():
            vals = [r[dk] for r in runs_out]
            if max(vals) - min(vals) > 1:
                fails.append(f"{sk}={vals}")
        risks = {r["narrative_risk"] for r in runs_out}
        if len(risks) > 1:
            fails.append(f"risk={sorted(risks)}")
        if fails:
            ok_all = False
            L.append(f"  [{cid}] HORS BANDE : " + "; ".join(fails))
        else:
            L.append(f"  [{cid}] OK")
    if not ok_all:
        L.append("  ⚠ Instabilité détectée — vérifier temperature=0 / top_p=1 dans app/lib/deepseek.py.")
    return L, ok_all


def contrast(contrast_fn, results):
    """contrast_fn(r) -> list of (label, ok_bool, detail). r(id, field) reads first run."""
    def r(cid, field):
        return primary(results[cid])[field]
    L = ["\nPAIRES DE CONTRASTE (cohérence du SENS des écarts) :"]
    ok_all = True
    for label, ok, detail in contrast_fn(r):
        ok_all = ok_all and ok
        L.append(f"  [{'OK ' if ok else 'KO!'}] {label}  —  {detail}")
    return L, ok_all


def paraphrase(bs, para, runs):
    """Same meaning reworded N× → global stable within ±TOL_GLOBAL across variants."""
    L = [f"\nROBUSTESSE PARAPHRASE — « {para['label']} » (global stable à ±{TOL_GLOBAL}) :"]
    globals_ = []
    for i, variant in enumerate(para["variants"], 1):
        meta = dict(para["meta"]); meta["titre"] = f"Paraphrase {i}"
        # collapse `runs` into the median run to keep cost low but stable
        gs = [_analyze_message(bs, variant, meta)["clarity_score"] for _ in range(runs)]
        g = sorted(gs)[len(gs) // 2]
        globals_.append(g)
        L.append(f"  variante {i} : global={g}")
    spread = max(globals_) - min(globals_)
    ok = spread <= TOL_GLOBAL
    L.append(f"  spread = {spread}  →  {'OK ✓' if ok else 'HORS BANDE'}")
    return L, ok


def cross_brand(pair, message, meta):
    """
    Evaluate the SAME message against two different brand systems. Scores must
    DIFFER — identical output proves the engine ignores the brand system.
    `pair` = [(brand_name, bs_dict), (brand_name, bs_dict)].
    """
    L = ["\nCROSS-BRAND — même message générique, deux brand systems différents :",
         f"  Message : « {message} »"]
    out = []
    for brand, bs in pair:
        res = _analyze_message(bs, message, meta)
        out.append((brand, res))
        L.append(f"  [{brand:<12}] global={res['clarity_score']:>3}  "
                 f"Ton={res['sub_tone']:>2}  Ali={res['sub_alignment']:>2}  risk={res['narrative_risk']}")
    (b1, r1), (b2, r2) = out
    differs = (r1["clarity_score"] != r2["clarity_score"]) or (r1["sub_tone"] != r2["sub_tone"])
    L.append(f"  Décision : {'scores DIFFÉRENTS ✓ (le moteur lit le brand system)' if differs else 'IDENTIQUES — RÉGRESSION : brand system ignoré ✗'}")
    return L, differs


def _median_result(bs, message, meta, runs):
    """Run an arm `runs` times and return a per-field median result (damps LLM jitter)."""
    outs = [_analyze_message(bs, message, meta) for _ in range(runs)]
    med = lambda vals: sorted(vals)[len(vals) // 2]
    fields = ["clarity_score", *SUB_MAP.values()]
    r = {f: med([o[f] for o in outs]) for f in fields}
    risks = [o["narrative_risk"] for o in outs]
    r["narrative_risk"] = max(set(risks), key=risks.count)  # mode
    return r


def channel_sensitivity(bs, tests, dump_payload_for=None, runs=3):
    """
    Same message, DIFFERENT metadata (canal/type/audience) → scores must diverge.
    Proves the engine reads metadata, not only the text. Each arm is the per-field
    MEDIAN of `runs` calls, so a single noisy draw can't decide pass/fail.
    `tests` = list of {label, message, arms:[{name, meta}], assert: fn(res_by_arm)->(ok,detail)}.
    If `dump_payload_for` matches a test label, the exact payload of its first arm is shown
    (diagnostic: confirms Canal/Type/Audience actually reach the model).
    """
    from app.services.brand_analysis_service import build_user_payload
    L = [f"\nSENSIBILITÉ MÉTADONNÉES (même message, métadonnées différentes → scores divergents ; "
         f"médiane de {runs} runs/branche) :"]
    ok_all = True
    for t in tests:
        L.append(f"\n  {t['label']}")
        res_by_arm = {}
        for arm in t["arms"]:
            res_by_arm[arm["name"]] = _median_result(bs, t["message"], arm["meta"], runs)
            r = res_by_arm[arm["name"]]
            L.append(f"    [{arm['name']:<22}] global={r['clarity_score']:>3}  "
                     f"Ton={r['sub_tone']:>2}  Foc={r['sub_focus']:>2}  Ali={r['sub_alignment']:>2}  risk={r['narrative_risk']}")
        ok, detail = t["assert"](res_by_arm)
        ok_all = ok_all and ok
        L.append(f"    → ASSERTION {'OK ✓' if ok else 'KO ✗'} : {detail}")
        if dump_payload_for and dump_payload_for in t["label"] and not ok:
            arm0 = t["arms"][0]
            payload = build_user_payload(
                bs, {"titre": "diag", "langue": "fr", "corps": t["message"]},
                {"canal": arm0["meta"].get("canal"), "audience": arm0["meta"].get("audience"),
                 "objectif": arm0["meta"].get("objectif"), "type_prise_parole": arm0["meta"].get("type")})
            block = payload[payload.find("MÉTADONNÉES"):payload.find("MESSAGE À ANALYSER")]
            L.append("    DIAGNOSTIC — bloc métadonnées réellement envoyé au modèle :")
            L += ["      " + ln for ln in block.strip().splitlines()]
    return L, ok_all


def latency_block(latencies):
    def pct(sv, p):
        if not sv:
            return 0.0
        k = (len(sv) - 1) * p; lo = int(k); hi = min(lo + 1, len(sv) - 1)
        return sv[lo] + (sv[hi] - sv[lo]) * (k - lo)
    sl = sorted(latencies)
    L = [f"\n{'':=<142}", f"  LATENCE — {len(sl)} appels"]
    if sl:
        L.append(f"  p50={pct(sl,0.50):6.2f}s  p95={pct(sl,0.95):6.2f}s  "
                 f"min={sl[0]:6.2f}s  max={sl[-1]:6.2f}s  moy={sum(sl)/len(sl):6.2f}s")
    L.append(f"{'':=<142}")
    return L


def scorecard(rows):
    """rows = [(label, ok_bool_or_None)]. None → informational."""
    L = [f"\n{'':=<142}", "  SCORECARD", f"{'':─<142}"]
    for label, ok in rows:
        mark = "—   " if ok is None else ("PASS" if ok else "FAIL")
        L.append(f"  [{mark}] {label}")
    L.append(f"{'':=<142}")
    return L
