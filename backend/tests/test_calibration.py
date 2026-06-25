"""
tests/test_calibration.py — Calibration suite for Clarity Engine v3 / Technopark
─────────────────────────────────────────────────────────────────────────────────
Runs 15 brand-message cases against the Technopark brand system via the
analyze() service (same as /api/analyze but bypassing HTTP/DB overhead).

WORKFLOW
  1. Session fixture `all_results` runs every case 3 times (45 API calls).
  2. Once all results are collected, the calibration report table is printed
     to stdout — BEFORE any assertion is evaluated.
  3. Parametrised test functions then enforce hard assertions on those results.

Run with:
  cd clarity-engine/backend
  pytest tests/test_calibration.py -v -s --tb=short

Flags:
  -s        → enables stdout so the report table prints
  --tb=short → compact tracebacks for failed assertions
  -k "01"   → run a single case ID for quick iteration
"""

import os
import pytest
from dotenv import load_dotenv

load_dotenv()

# Calibration runs 45 sequential API calls; 90 s per-request prevents spurious timeouts.
# Overrides DEEPSEEK_TIMEOUT read in app/lib/deepseek.py on each _create() call.
os.environ.setdefault("DEEPSEEK_TIMEOUT", "90")

from app.services.brand_analysis_service import analyze  # noqa: E402

# ─────────────────────────────────────────────────────────────────────────────
# TECHNOPARK BRAND SYSTEM
# (mirrors seed_technopark_direct.py — must stay in sync with actual DB seed)
# ─────────────────────────────────────────────────────────────────────────────

TECHNOPARK_BS = {
    "nom_marque": "Technopark",
    "role_marque": (
        "Premier hub entrepreneurial au Maroc. Moteur de l'innovation technologique et digitale, "
        "Technopark offre un écosystème inclusif et performant pour transformer les idées en succès "
        "entrepreneuriaux à fort impact. Accélérateur d'entrepreneuriat et d'innovation technologique "
        "depuis plus de 20 ans — né d'une volonté royale."
    ),
    "master_statement": (
        "The Impact Hub — Au-delà de l'espace, l'impact.\n"
        "Faire grandir l'innovation.\n"
        "Transformons les idées en impact."
    ),
    "priorites_strategiques": [
        "Accompagnement entrepreneurial : Soutien structuré de l'idée à la croissance "
        "(incubation, accélération, accès au financement).",
        "Ancrage technologique : Expertise et infrastructures de pointe pour les écosystèmes tech et digital.",
        "Communauté active : Networking et collaboration intense entre startups, investisseurs, "
        "grands groupes et institutions.",
        "Couverture territoriale : Présence stratégique dans les différentes régions du Maroc "
        "pour un rayonnement national.",
    ],
    "territoires_narratifs": [
        "L'écosystème entrepreneurial marocain — connecter les talents, les territoires et la technologie.",
        "L'innovation à impact : transformer les idées en succès mesurables.",
        "Le hub national de référence : seul réseau national marocain combinant accompagnement, "
        "connexion et ancrage territorial.",
        "La communauté et l'appartenance : fédérer startups, porteurs de projets, investisseurs "
        "et institutions autour d'une même ambition.",
    ],
    "ton_marque": (
        "Inspirant : donner envie d'agir, transmettre de l'énergie et de la conviction.\n"
        "Humain : parler des personnes avant les projets, rester accessible et chaleureux.\n"
        "Moderne : refléter l'innovation et le digital sans jargon inutile.\n"
        "Accessible : phrases directes, simples et claires.\n"
        "Fédérateur : relier entrepreneurs, institutions, investisseurs et territoires.\n"
        "Énergique : verbes d'action, lexique lié à l'impact et à la transformation."
    ),
    "lignes_rouges": [
        "Ne jamais appeler les startups ou membres 'Locataires' → utiliser 'Membres' ou 'Startups'.",
        "Ne jamais parler d''Espace de bureau' → utiliser 'Hub'.",
        "Éviter 'Infrastructures passives' → elles sont actives et structurantes.",
        "Éviter 'Simple assistance' → Technopark est un partenaire, pas un prestataire.",
        "Ne jamais adopter un ton administratif, bureaucratique ou distant.",
        "Ne pas réduire Technopark à un bailleur immobilier ou un centre de coworking ordinaire.",
    ],
    "mots_a_privilegier": [
        "Innovation", "impact", "réseau", "talent", "accompagner", "connecter", "révéler",
        "accélérer", "transformer", "impulser", "hub technologique", "lieu de vie et d'échange",
        "partenaire", "écosystème", "communauté", "ancrage", "rayonnement", "croissance",
        "territoire", "digital", "entrepreneuriat",
    ],
    "mots_a_eviter": [
        "Locataire", "espace de bureau", "infrastructures passives", "simple assistance",
        "bailleur", "coworking ordinaire", "administratif", "bureaucratique",
    ],
    "audiences_cles": [
        "Startups en phase d'idéation, de création ou de croissance.",
        "Porteurs de projets technologiques et digitaux.",
        "TPE/PME technologiques à fort potentiel.",
        "Investisseurs (business angels, fonds de capital-risque).",
        "Grands groupes cherchant l'open innovation.",
        "Institutions publiques et partenaires académiques.",
    ],
    "contexte_sectoriel": "Technologie, Digital, Entrepreneuriat, Innovation",
}

# ─────────────────────────────────────────────────────────────────────────────
# 15 CALIBRATION CASES
# ─────────────────────────────────────────────────────────────────────────────

CASES = [
    {
        "id": "01",
        "canal": "Institutionnel / Film",
        "audience": "Grand public / institutionnel",
        "type": "Prise de parole corporate",
        "objectif": "Affirmer l'identité de marque",
        "message": "Nous sommes Technopark. Et partout au Maroc, nous faisons grandir l'innovation.",
        "sub": {"clarity": 19, "alignment": 20, "focus": 19, "tone": 19, "narrative_contribution": 20},
        "global": 97,
        "risk": "Low",
    },
    {
        "id": "02",
        "canal": "LinkedIn",
        "audience": "Startups, investisseurs",
        "type": "Post réseaux sociaux",
        "objectif": "Présenter l'offre Technopark",
        "message": "Notre game-changing platform connects scale-ups to next-level opportunities.",
        "sub": {"clarity": 8, "alignment": 1, "focus": 10, "tone": 1, "narrative_contribution": 1},
        "global": 21,
        "risk": "High",
        "redline": True,
    },
    {
        "id": "03",
        "canal": "Site institutionnel / Communiqué",
        "audience": "Institutionnels, partenaires, presse",
        "type": "Message institutionnel",
        "objectif": "Affirmer la légitimité et l'ancrage historique",
        "message": (
            "Technopark, premier hub entrepreneurial marocain, accompagne depuis 25 ans les "
            "startups et PME innovantes à l'échelle du Royaume."
        ),
        "sub": {"clarity": 18, "alignment": 19, "focus": 17, "tone": 17, "narrative_contribution": 18},
        "global": 89,
        "risk": "Low",
    },
    {
        "id": "04",
        "canal": "LinkedIn / Instagram",
        "audience": "Entrepreneurs, jeunes talents, grand public",
        "type": "Post réseaux sociaux",
        "objectif": "Engager, inspirer, valoriser l'écosystème",
        "message": "3 startups. 3 villes. 1 seule ambition : transformer le Maroc de l'intérieur.",
        "sub": {"clarity": 17, "alignment": 17, "focus": 18, "tone": 18, "narrative_contribution": 17},
        "global": 87,
        "risk": "Low",
    },
    {
        "id": "05",
        "canal": "Communication interne / Note de direction",
        "audience": "Équipes internes, direction",
        "type": "Note interne",
        "objectif": "Présenter une initiative stratégique",
        "message": (
            "Dans le cadre de notre mission d'accompagnement institutionnel, "
            "nous déployons des synergies écosystémiques."
        ),
        "sub": {"clarity": 4, "alignment": 2, "focus": 7, "tone": 2, "narrative_contribution": 2},
        "global": 17,
        "risk": "High",
        "redline": True,
    },
    {
        "id": "06",
        "canal": "Rapport annuel / LinkedIn institutionnel",
        "audience": "Investisseurs, institutions, partenaires",
        "type": "Communication résultats",
        "objectif": "Démontrer l'impact concret et la crédibilité",
        "message": (
            "En 2024, 87 startups accompagnées à travers nos 6 sites régionaux, "
            "générant plus de 400 emplois directs."
        ),
        "sub": {"clarity": 18, "alignment": 19, "focus": 19, "tone": 15, "narrative_contribution": 19},
        "global": 90,
        "risk": "Low",
    },
    {
        "id": "07",
        "canal": "Site web / À propos",
        "audience": "Grand public",
        "type": "Présentation institutionnelle",
        "objectif": "Décrire le rôle de Technopark",
        "message": "Nous soutenons l'innovation.",
        "sub": {"clarity": 12, "alignment": 3, "focus": 10, "tone": 8, "narrative_contribution": 3},
        "global": 36,
        "risk": "High",
        "redline": True,
    },
    {
        "id": "08",
        "canal": "Événement / Discours d'ouverture",
        "audience": "Entrepreneurs, partenaires, institutionnels",
        "type": "Prise de parole événementielle",
        "objectif": "Mobiliser, créer l'adhésion collective",
        "message": "L'impact commence ici. L'impact commence avec vous. L'impact commence maintenant.",
        "sub": {"clarity": 16, "alignment": 16, "focus": 17, "tone": 18, "narrative_contribution": 17},
        "global": 84,
        "risk": "Low",
    },
    {
        "id": "09",
        "canal": "Site web / Présentation partenaire",
        "audience": "Investisseurs, institutions",
        "type": "Message de positionnement",
        "objectif": "Définir ce qu'est Technopark",
        "message": "Technopark est un lieu d'incubation pour startups.",
        "sub": {"clarity": 14, "alignment": 3, "focus": 12, "tone": 10, "narrative_contribution": 3},
        "global": 42,
        "risk": "High",
        "redline": True,
    },
    {
        "id": "10",
        "canal": "Communication partenariale / Lettre d'intention",
        "audience": "Partenaires institutionnels, investisseurs",
        "type": "Message partenarial",
        "objectif": "Démontrer la valeur de collaborer avec Technopark",
        "message": (
            "Ensemble, nous connectons les talents, les territoires et la technologie "
            "pour un impact durable."
        ),
        "sub": {"clarity": 18, "alignment": 20, "focus": 18, "tone": 18, "narrative_contribution": 19},
        "global": 93,
        "risk": "Low",
    },
    {
        "id": "11",
        "canal": "Réseaux sociaux / Affichage",
        "audience": "Grand public, jeunes entrepreneurs",
        "type": "Message inspirationnel",
        "objectif": "Susciter l'adhésion et l'identification",
        "message": "Chaque idée mérite une chance.",
        "sub": {"clarity": 16, "alignment": 11, "focus": 14, "tone": 14, "narrative_contribution": 9},
        "global": 64,
        "risk": "Medium",
    },
    {
        "id": "12",
        "canal": "Événementiel / Réseaux sociaux",
        "audience": "Entrepreneurs régionaux, étudiants, talents locaux",
        "type": "Annonce événementielle",
        "objectif": "Mobiliser les entrepreneurs de la région",
        "message": (
            "Technopark Agadir organise un hackathon ouvert à tous les porteurs de projets "
            "de la région Souss-Massa."
        ),
        "sub": {"clarity": 17, "alignment": 15, "focus": 16, "tone": 13, "narrative_contribution": 14},
        "global": 75,
        "risk": "Low",
    },
    {
        "id": "13",
        "canal": "LinkedIn / Site web",
        "audience": "Partenaires, entreprises",
        "type": "Message de positionnement",
        "objectif": "Décrire l'approche Technopark",
        "message": "Nous créons de la valeur pour l'écosystème via une approche holistique et disruptive.",
        "sub": {"clarity": 5, "alignment": 2, "focus": 6, "tone": 2, "narrative_contribution": 2},
        "global": 17,
        "risk": "High",
        "redline": True,
    },
    {
        "id": "14",
        "canal": "Site web / Présentation",
        "audience": "Grand public, entrepreneurs potentiels",
        "type": "Message de crédibilité",
        "objectif": "Rassurer et crédibiliser Technopark",
        "message": "Nous soutenons les entrepreneurs depuis longtemps et avec beaucoup de succès.",
        "sub": {"clarity": 11, "alignment": 5, "focus": 10, "tone": 8, "narrative_contribution": 5},
        "global": 39,
        "risk": "High",
    },
    {
        "id": "15",
        "canal": "Page d'accueil site web / Vidéo institutionnelle",
        "audience": "Tous publics",
        "type": "Message de marque central",
        "objectif": "Définir, différencier, inspirer",
        "message": (
            "Technopark n'est pas seulement un lieu. C'est une communauté, un réseau, une ambition "
            "partagée. Partout au Maroc, nous aidons les entrepreneurs à transformer leurs idées en impact."
        ),
        "sub": {"clarity": 18, "alignment": 19, "focus": 18, "tone": 18, "narrative_contribution": 19},
        "global": 92,
        "risk": "Low",
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

# Mapping: CASES["sub"] keys → validated dict keys returned by analyze()
_SUB_MAP = {
    "clarity":               "sub_lisibilite",
    "alignment":             "sub_alignment",
    "focus":                 "sub_focus",
    "tone":                  "sub_tone",
    "narrative_contribution": "sub_narrative_contribution",
}
_SUB_KEYS  = list(_SUB_MAP.keys())          # prompt-side key order
_DB_KEYS   = list(_SUB_MAP.values())        # flat DB key order


def _make_message(case: dict) -> dict:
    return {
        "titre":  f"Calibration case {case['id']}",
        "langue": "fr",
        "corps":  case["message"],
    }


def _make_metadata(case: dict) -> dict:
    return {
        "canal":             case["canal"],
        "audience":          case["audience"],
        "objectif":          case["objectif"],
        "type_prise_parole": case["type"],
        "date":              None,
        "auteur":            "calibration-test",
    }


def _run_once(case: dict) -> dict:
    """Single call to analyze() for one case. Returns the validated flat result dict."""
    return analyze(TECHNOPARK_BS, _make_message(case), _make_metadata(case))


def _is_in_band(case: dict, res: dict) -> bool:
    """True when ALL four criteria are within tolerance."""
    if abs(res["clarity_score"] - case["global"]) > 8:
        return False
    if res["narrative_risk"] != case["risk"]:
        return False
    for sk, dk in _SUB_MAP.items():
        if abs(res[dk] - case["sub"][sk]) > 3:
            return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# CALIBRATION REPORT — printed once, before any hard assertion
# ─────────────────────────────────────────────────────────────────────────────

def _print_report(case_map: dict[str, dict], results: dict[str, list[dict]]) -> None:
    """Print the calibration report table to stdout."""

    SHORT = {  # column-header abbreviations for sub-scores
        "clarity": "Cla", "alignment": "Ali", "focus": "Foc",
        "tone": "Ton", "narrative_contribution": "Nar",
    }

    # Header
    col_subs = "  ".join(f"{SHORT[k]}(T→O)" for k in _SUB_KEYS)
    hdr = (
        f"\n{'':=<132}\n"
        f"  RAPPORT DE CALIBRATION — Clarity Engine v3 / Technopark  "
        f"(tolérance: Δglobal ≤ 8, Δsub ≤ 3, risk exact)\n"
        f"{'':=<132}\n"
        f"{'ID':>2}  {'G_cible':>7}  {'G_obtenu':>8}  {'ΔG':>4}  "
        f"{'Risk_cible':>10}  {'Risk_obt':>8}  "
        f"{col_subs}  {'STATUT':>10}\n"
        f"{'':─<132}"
    )
    print(hdr)

    all_ok = True
    for case in CASES:
        cid  = case["id"]
        res  = results[cid][0]   # first of 3 runs for the report

        g_t  = case["global"]
        g_o  = res["clarity_score"]
        dg   = g_o - g_t

        rt   = case["risk"]
        ro   = res["narrative_risk"]

        sub_cols = []
        sub_ok   = True
        for sk, dk in _SUB_MAP.items():
            t = case["sub"][sk]
            o = res[dk]
            d = o - t
            flag = "" if abs(d) <= 3 else "!"
            sub_cols.append(f"{t:>2}→{o:<2}{flag}")
        sub_str = "  ".join(sub_cols)

        status = "OK" if _is_in_band(case, res) else "HORS BANDE"
        if status != "OK":
            all_ok = False

        risk_flag = "" if ro == rt else " !"
        print(
            f"{cid:>2}  {g_t:>7}  {g_o:>8}  {dg:>+4}  "
            f"{rt:>10}  {ro:>8}{risk_flag}  "
            f"{sub_str}  {status:>10}"
        )

    print(f"{'':═<132}")
    summary = "ALL CASES IN BAND" if all_ok else "SOME CASES OUT OF BAND — see HORS BANDE rows above"
    print(f"  {summary}\n{'':=<132}\n")


# ─────────────────────────────────────────────────────────────────────────────
# SESSION FIXTURE — runs 15 × 3 = 45 API calls, then prints the report
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def all_results() -> dict[str, list[dict]]:
    """
    For every case: call analyze() 3 times (for repeatability).
    Returns {case_id: [run1, run2, run3]}.
    Prints the calibration table after all calls complete.
    """
    case_map = {c["id"]: c for c in CASES}
    results: dict[str, list[dict]] = {}

    print(f"\n[calibration] Running {len(CASES)} cases × 3 = {len(CASES) * 3} API calls …")
    for case in CASES:
        runs = []
        for run_idx in range(3):
            print(f"  case {case['id']} run {run_idx + 1}/3 …", flush=True)
            runs.append(_run_once(case))
        results[case["id"]] = runs

    _print_report(case_map, results)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# TEST 1 — Schema validity + score invariant (clarity_score == Σ sub-scores)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_schema_and_invariant(case, all_results):
    """Schema valid; clarity_score equals the exact sum of the 5 sub-scores."""
    res = all_results[case["id"]][0]

    # Score invariant — this is an absolute requirement
    computed = sum(res[dk] for dk in _DB_KEYS)
    assert res["clarity_score"] == computed, (
        f"[{case['id']}] clarity_score={res['clarity_score']} ≠ "
        f"Σ sub-scores={computed}  ({_DB_KEYS} = {[res[dk] for dk in _DB_KEYS]})"
    )

    # reasoning — 5 non-empty strings
    reasoning = res.get("reasoning", {})
    assert isinstance(reasoning, dict), f"[{case['id']}] reasoning must be a dict"
    for rk in _SUB_KEYS:
        assert rk in reasoning and reasoning[rk].strip(), (
            f"[{case['id']}] reasoning['{rk}'] is missing or empty"
        )

    # points_forts / points_faibles — 3 × {text, evidence}
    for field in ("points_forts", "points_faibles"):
        items = res.get(field, [])
        assert len(items) == 3, f"[{case['id']}] {field} must have 3 items, got {len(items)}"
        for i, item in enumerate(items):
            assert "text" in item and item["text"].strip(), (
                f"[{case['id']}] {field}[{i}].text is missing or empty"
            )
            assert "evidence" in item, f"[{case['id']}] {field}[{i}].evidence key absent"

    # recommandations — 3 × {text, brand_element}
    recos = res.get("recommandations", [])
    assert len(recos) == 3, f"[{case['id']}] recommandations must have 3 items, got {len(recos)}"
    for i, reco in enumerate(recos):
        assert "text" in reco and reco["text"].strip(), (
            f"[{case['id']}] recommandations[{i}].text is missing or empty"
        )
        assert "brand_element" in reco and reco["brand_element"].strip(), (
            f"[{case['id']}] recommandations[{i}].brand_element is missing or empty"
        )


# ─────────────────────────────────────────────────────────────────────────────
# TEST 2 — Global score within ±8 of target
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_global_score_in_band(case, all_results):
    """Global clarity_score must be within ±8 of the calibration target."""
    res = all_results[case["id"]][0]
    g_obtained = res["clarity_score"]
    g_target   = case["global"]
    delta      = abs(g_obtained - g_target)
    assert delta <= 8, (
        f"[{case['id']}] global {g_obtained} vs target {g_target}  Δ={g_obtained - g_target:+d}  (tolerance ±8)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEST 3 — Every sub-score within ±3 of target
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_sub_scores_in_band(case, all_results):
    """Each of the 5 sub-scores must be within ±3 of the calibration target."""
    res = all_results[case["id"]][0]
    failures = []
    for sk, dk in _SUB_MAP.items():
        t = case["sub"][sk]
        o = res[dk]
        if abs(o - t) > 3:
            failures.append(f"{sk}: obtained={o}, target={t}, Δ={o - t:+d}")
    assert not failures, (
        f"[{case['id']}] sub-scores out of band (tolerance ±3):\n  " + "\n  ".join(failures)
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEST 4 — narrative_risk exact match
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_narrative_risk_exact(case, all_results):
    """narrative_risk must exactly match the calibration target."""
    res = all_results[case["id"]][0]
    obtained = res["narrative_risk"]
    expected = case["risk"]
    assert obtained == expected, (
        f"[{case['id']}] narrative_risk obtained={obtained!r}, expected={expected!r}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEST 5 — Red-line hard rule (redline cases only)
# ─────────────────────────────────────────────────────────────────────────────

REDLINE_CASES = [c for c in CASES if c.get("redline")]


@pytest.mark.parametrize("case", REDLINE_CASES, ids=[c["id"] for c in REDLINE_CASES])
def test_redline_rule(case, all_results):
    """Red-line cases must have alignment ≤ 5 AND narrative_risk == 'High'."""
    res = all_results[case["id"]][0]

    assert res["sub_alignment"] <= 5, (
        f"[{case['id']}] Red-line case: sub_alignment={res['sub_alignment']} must be ≤ 5"
    )
    assert res["narrative_risk"] == "High", (
        f"[{case['id']}] Red-line case: narrative_risk={res['narrative_risk']!r} must be 'High'"
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEST 6 — Repeatability: 3 runs must agree within ±1 per sub-score
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_repeatability(case, all_results):
    """
    The 3 repeated runs must be mutually stable: for every sub-score,
    max(run1, run2, run3) − min(run1, run2, run3) ≤ 1.
    """
    runs = all_results[case["id"]]
    failures = []
    for dk in _DB_KEYS:
        scores = [r[dk] for r in runs]
        spread = max(scores) - min(scores)
        if spread > 1:
            failures.append(f"{dk}: runs={scores}, spread={spread}")

    assert not failures, (
        f"[{case['id']}] Sub-scores vary too much across 3 runs (tolerance ±1):\n  "
        + "\n  ".join(failures)
    )
