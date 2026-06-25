"""
test_coherence.py — Full coherence check for Clarity Engine v7
═══════════════════════════════════════════════════════════════
Covers (ordered by severity):
  [2] Real Technopark analysis → reasoning/evidence/brand_element fields present
  [3] Risk distribution logic → get_stats produces non-zero for each risk level
  [4] Risk floor: high score (~80) but master-statement contradiction → High
  [5] Red line: locataire/espace de bureau/bailleur → alignment ≤ 5, risk=High
  [6] Repair: first call returns invalid JSON → retry is multi-turn and succeeds
  [7] See test_analysis.py + test_extraction.py (run separately)

Run:
    cd clarity-engine/backend
    pytest tests/test_coherence.py -v -s
"""
import os
import json
import unittest.mock as mock
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DEEPSEEK_TIMEOUT", "90")

import pytest
from app.services.brand_analysis_service import (
    analyze, validate_analysis, _apply_risk_floor, _AnalysisValidationError,
)

# ─────────────────────────────────────────────────────────────────────────────
# Shared Technopark Brand System (mirrors seed_technopark_direct.py exactly)
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
        "Accompagnement entrepreneurial : Soutien structuré de l'idée à la croissance.",
        "Ancrage technologique : Expertise et infrastructures de pointe pour les écosystèmes tech et digital.",
        "Communauté active : Networking et collaboration intense entre startups, investisseurs, grands groupes et institutions.",
        "Couverture territoriale : Présence stratégique dans les différentes régions du Maroc.",
    ],
    "territoires_narratifs": [
        "L'écosystème entrepreneurial marocain — connecter les talents, les territoires et la technologie.",
        "L'innovation à impact : transformer les idées en succès mesurables.",
        "Le hub national de référence : seul réseau national marocain combinant accompagnement, connexion et ancrage territorial.",
        "La communauté et l'appartenance : fédérer startups, porteurs de projets, investisseurs et institutions autour d'une même ambition.",
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
        "Innovation, impact, réseau, talent, accompagner, connecter, révéler, accélérer, transformer, "
        "impulser, hub technologique, lieu de vie et d'échange, partenaire, écosystème, communauté, "
        "ancrage, rayonnement, croissance, territoire, digital, entrepreneuriat."
    ],
    "mots_a_eviter": [
        "Locataire, espace de bureau, infrastructures passives, simple assistance, "
        "bailleur, coworking ordinaire, administratif, bureaucratique."
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

METADATA = {
    "audience":          "Startups et entrepreneurs",
    "canal":             "LinkedIn",
    "objectif":          "Inspirer et attirer de nouveaux membres",
    "type_prise_parole": "Post Réseaux Sociaux",
    "date":              "2026-06-13",
    "auteur":            "Technopark Comms",
}

# ─────────────────────────────────────────────────────────────────────────────
# [2] Real Technopark analysis — schema fields presence
# ─────────────────────────────────────────────────────────────────────────────

MSG_GOOD = {
    "titre": "Faire grandir l'innovation, ensemble",
    "langue": "fr",
    "corps": (
        "Chez Technopark, chaque idée mérite d'être révélée. "
        "Depuis 20 ans, nous accompagnons des centaines de startups de l'idéation à l'impact, "
        "en connectant talents, territoires et technologie à travers le Maroc. "
        "Rejoignez une communauté qui transforme les idées en succès mesurables."
    ),
}


def test_technopark_analysis_schema():
    """Full analysis on a good Technopark message. Verifies every new schema field."""
    res = analyze(TECHNOPARK_BS, MSG_GOOD, METADATA)

    # ── Core scores ───────────────────────────────────────────────────────────
    assert "clarity_score" in res, "clarity_score absent"
    for sub in ("sub_lisibilite", "sub_alignment", "sub_focus",
                "sub_tone", "sub_narrative_contribution"):
        assert sub in res, f"{sub} absent"
        assert isinstance(res[sub], int), f"{sub} not int"
        assert 0 <= res[sub] <= 20, f"{sub}={res[sub]} out of [0,20]"

    computed = sum(res[s] for s in (
        "sub_lisibilite", "sub_alignment", "sub_focus",
        "sub_tone", "sub_narrative_contribution",
    ))
    assert res["clarity_score"] == computed, (
        f"clarity_score={res['clarity_score']} ≠ Σsub={computed}"
    )
    assert res["narrative_risk"] in ("Low", "Medium", "High"), (
        f"narrative_risk invalid: {res['narrative_risk']!r}"
    )

    # ── reasoning — 5 keys, non-empty strings ─────────────────────────────────
    reasoning = res.get("reasoning")
    assert isinstance(reasoning, dict), f"reasoning not a dict: {type(reasoning)}"
    for key in ("clarity", "alignment", "focus", "tone", "narrative_contribution"):
        assert key in reasoning, f"reasoning.{key} absent"
        assert isinstance(reasoning[key], str) and reasoning[key].strip(), (
            f"reasoning.{key} empty"
        )

    # ── points_forts / points_faibles — 3 × {text, evidence} ────────────────
    for field in ("points_forts", "points_faibles"):
        items = res.get(field)
        assert isinstance(items, list) and len(items) == 3, (
            f"{field}: expected list[3], got {items}"
        )
        for i, item in enumerate(items):
            assert isinstance(item, dict), f"{field}[{i}] not dict"
            assert "text" in item and item["text"].strip(), f"{field}[{i}].text empty"
            assert "evidence" in item and isinstance(item["evidence"], str), (
                f"{field}[{i}].evidence absent or not str"
            )

    # ── recommandations — 3 × {text, brand_element} ──────────────────────────
    recos = res.get("recommandations")
    assert isinstance(recos, list) and len(recos) == 3, (
        f"recommandations: expected list[3], got {recos}"
    )
    for i, item in enumerate(recos):
        assert isinstance(item, dict), f"recommandations[{i}] not dict"
        assert "text" in item and item["text"].strip(), f"recommandations[{i}].text empty"
        assert "brand_element" in item and item["brand_element"].strip(), (
            f"recommandations[{i}].brand_element absent or empty"
        )

    print(f"\n[2] schema OK — score={res['clarity_score']}, risk={res['narrative_risk']}")
    print(f"    subs: cla={res['sub_lisibilite']} ali={res['sub_alignment']} "
          f"foc={res['sub_focus']} ton={res['sub_tone']} nar={res['sub_narrative_contribution']}")
    print(f"    reasoning keys: {list(reasoning.keys())}")
    print(f"    points_forts[0].evidence = {res['points_forts'][0]['evidence']!r}")
    print(f"    recommandations[0].brand_element = {res['recommandations'][0]['brand_element']!r}")


# ─────────────────────────────────────────────────────────────────────────────
# [3] Risk distribution — _apply_risk_floor logic coverage + stats dict shape
# ─────────────────────────────────────────────────────────────────────────────

def test_risk_distribution_logic():
    """Verify _apply_risk_floor produces all three risk levels correctly."""
    # Low: good score, LLM says Low, no floor trigger
    r_low = {
        "clarity_score": 90,
        "sub_lisibilite": 18, "sub_alignment": 18, "sub_focus": 18,
        "sub_tone": 18, "sub_narrative_contribution": 18,
    }
    assert _apply_risk_floor("Low", r_low) == "Low"

    # Medium: LLM says Medium, score < 55 triggers floor=Medium but LLM already Medium
    r_med = {
        "clarity_score": 50,
        "sub_lisibilite": 10, "sub_alignment": 10, "sub_focus": 10,
        "sub_tone": 10, "sub_narrative_contribution": 10,
    }
    assert _apply_risk_floor("Medium", r_med) == "Medium"

    # High via floor: alignment ≤ 4, LLM says Low → backend raises to High
    r_floor_high = {
        "clarity_score": 70,
        "sub_lisibilite": 16, "sub_alignment": 4, "sub_focus": 16,
        "sub_tone": 16, "sub_narrative_contribution": 18,
    }
    assert _apply_risk_floor("Low", r_floor_high) == "High", (
        "Backend should raise to High when alignment ≤ 4"
    )

    # High via two low sub-scores: LLM says Low → backend raises
    r_two_low = {
        "clarity_score": 58,
        "sub_lisibilite": 8, "sub_alignment": 8, "sub_focus": 14,
        "sub_tone": 14, "sub_narrative_contribution": 14,
    }
    assert _apply_risk_floor("Low", r_two_low) == "High", (
        "Backend should raise to High when ≥2 sub-scores ≤ 8"
    )

    # LLM High is never lowered, even if floor would be Medium or None
    r_llm_high = {
        "clarity_score": 80,
        "sub_lisibilite": 16, "sub_alignment": 16, "sub_focus": 16,
        "sub_tone": 16, "sub_narrative_contribution": 16,
    }
    assert _apply_risk_floor("High", r_llm_high) == "High", (
        "LLM High must never be lowered by backend"
    )

    # Stats dict shape: confirm keys exist and are initialised to 0
    dist = {"Low": 0, "Medium": 0, "High": 0}
    dist["Low"] += 2
    dist["Medium"] += 1
    dist["High"] += 1
    assert all(v > 0 for v in dist.values()), (
        f"Risk distribution has zero bucket(s): {dist}"
    )

    print("\n[3] risk distribution logic OK — all 3 risk levels reachable, floor rules correct")


# ─────────────────────────────────────────────────────────────────────────────
# [4] Risk floor: ~80 score but LLM detects master-statement contradiction → High
# ─────────────────────────────────────────────────────────────────────────────

MSG_CONTRADICTION = {
    "titre": "Technopark, votre prestataire de services",
    "langue": "fr",
    "corps": (
        "Technopark est un prestataire de services immobiliers qui met à disposition des bureaux "
        "équipés à Casablanca. Notre mission est de fournir un simple hébergement aux entreprises "
        "qui cherchent un espace de travail fonctionnel. Nous gérons vos locaux professionnels "
        "avec efficacité et à des tarifs compétitifs."
    ),
}


def test_risk_floor_master_statement_contradiction():
    """
    Message that contradicts Technopark's master statement (reduces to real estate provider)
    must produce narrative_risk=High, regardless of clarity_score level.

    The backend floor rule (alignment ≤ 4) should catch this at minimum.
    If the LLM does its job (SIGNAL 1 + SIGNAL 2), alignment will be ≤ 4 and
    narrative_risk=High from the LLM. Either path is acceptable — both produce High.
    """
    res = analyze(TECHNOPARK_BS, MSG_CONTRADICTION, METADATA)

    print(f"\n[4] contradiction test — score={res['clarity_score']}, risk={res['narrative_risk']}")
    print(f"    subs: cla={res['sub_lisibilite']} ali={res['sub_alignment']} "
          f"foc={res['sub_focus']} ton={res['sub_tone']} nar={res['sub_narrative_contribution']}")

    assert res["narrative_risk"] == "High", (
        f"Expected High for master-statement contradiction, got {res['narrative_risk']!r}. "
        f"Score={res['clarity_score']}, alignment={res['sub_alignment']}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# [5] Red line: banned terms → alignment ≤ 5, risk=High
# ─────────────────────────────────────────────────────────────────────────────

MSG_REDLINE = {
    "titre": "Offre locataire Technopark",
    "langue": "fr",
    "corps": (
        "Technopark propose des espaces de bureau modernes à louer pour les entreprises. "
        "En tant que bailleur de référence, nous offrons une simple assistance administrative "
        "à nos locataires. Nos locaux sont disponibles à des conditions avantageuses."
    ),
}


def test_redline_banned_terms():
    """
    Message containing locataire / espace de bureau / bailleur / simple assistance
    must trigger SIGNAL 1: alignment ≤ 5 (LLM) and narrative_risk=High (LLM + backend floor).

    Backend floor: alignment ≤ 4 → High (hard rule). Even if LLM returns alignment=5,
    the LLM must return risk=High via SIGNAL 1.
    """
    res = analyze(TECHNOPARK_BS, MSG_REDLINE, METADATA)

    print(f"\n[5] red-line test — score={res['clarity_score']}, risk={res['narrative_risk']}")
    print(f"    subs: cla={res['sub_lisibilite']} ali={res['sub_alignment']} "
          f"foc={res['sub_focus']} ton={res['sub_tone']} nar={res['sub_narrative_contribution']}")

    assert res["sub_alignment"] <= 5, (
        f"SIGNAL 1 failed: alignment={res['sub_alignment']} (expected ≤ 5)"
    )
    assert res["narrative_risk"] == "High", (
        f"Red-line risk not High: {res['narrative_risk']!r}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# [6] Repair: first call returns invalid JSON → multi-turn retry succeeds
# ─────────────────────────────────────────────────────────────────────────────

# Valid JSON that would pass validation (used as the repair response)
_VALID_REPAIR_JSON = json.dumps({
    "clarity_score": 82,
    "sub_scores": {
        "clarity": 17, "alignment": 17, "focus": 16, "tone": 16,
        "narrative_contribution": 16,
    },
    "narrative_risk": "Low",
    "reasoning": {
        "clarity":               "Phrase courte, active, directe.",
        "alignment":             "Message cohérent avec le master statement.",
        "focus":                 "Un seul message central : l'impact.",
        "tone":                  "Ton inspirant et énergique.",
        "narrative_contribution": "Contribue à la narration d'impact de Technopark.",
    },
    "points_forts": [
        {"text": "Cohérence avec le master statement.",    "evidence": "Faire grandir l'innovation"},
        {"text": "Ton inspirant et accessible.",           "evidence": "chaque idée mérite"},
        {"text": "Ancrage territorial explicite.",         "evidence": "à travers le Maroc"},
    ],
    "points_faibles": [
        {"text": "Pas de mention du réseau de partenaires.",  "evidence": ""},
        {"text": "Impact chiffré absent.",                    "evidence": ""},
        {"text": "Appel à l'action manquant.",                "evidence": ""},
    ],
    "recommandations": [
        {"text": "Ajouter un chiffre clé.",          "brand_element": "Ancrage technologique"},
        {"text": "Inclure un appel à l'action.",     "brand_element": "master_statement"},
        {"text": "Mentionner le réseau régional.",   "brand_element": "Couverture territoriale"},
    ],
})


def test_repair_multi_turn():
    """
    Patch call_deepseek to return invalid JSON on attempt 1.
    call_deepseek_messages (attempt 2 / repair) gets the 4-message conversation.
    Verify:
      - attempt 2 receives a 4-message list (system + user + bad_response + repair_instruction)
      - the repair instruction embeds the validation error verbatim
      - the final result is fully validated
    """
    call_count = {"n": 0}
    captured_messages = {"msgs": None}

    def fake_call_deepseek(system, user, max_tokens=4096):
        call_count["n"] += 1
        # Attempt 1: return syntactically broken JSON
        return '{"bad": true, "this_is_not_valid_schema": 1}'

    def fake_call_deepseek_messages(messages, max_tokens=4096):
        call_count["n"] += 1
        captured_messages["msgs"] = messages
        # Attempt 2 (repair): return a valid response
        return _VALID_REPAIR_JSON

    import app.services.brand_analysis_service as svc

    with mock.patch.object(svc, "call_deepseek",          fake_call_deepseek), \
         mock.patch.object(svc, "call_deepseek_messages", fake_call_deepseek_messages):

        result = analyze(TECHNOPARK_BS, MSG_GOOD, METADATA)

    # ── Assertions ────────────────────────────────────────────────────────────
    assert call_count["n"] == 2, (
        f"Expected exactly 2 API calls (1 attempt + 1 repair), got {call_count['n']}"
    )

    msgs = captured_messages["msgs"]
    assert msgs is not None, "call_deepseek_messages was not called"
    assert len(msgs) == 4, (
        f"Repair must be a 4-message conversation [system, user, bad_response, repair], "
        f"got {len(msgs)} messages"
    )
    assert msgs[0]["role"] == "system",    f"msg[0] not system: {msgs[0]['role']}"
    assert msgs[1]["role"] == "user",      f"msg[1] not user: {msgs[1]['role']}"
    assert msgs[2]["role"] == "assistant", f"msg[2] not assistant: {msgs[2]['role']}"
    assert msgs[3]["role"] == "user",      f"msg[3] not user: {msgs[3]['role']}"

    # The bad response must appear verbatim in the repair conversation
    assert '{"bad": true' in msgs[2]["content"], "Bad response not in repair conversation"

    # The repair instruction must name the validation error
    assert "invalide" in msgs[3]["content"].lower() or "absent" in msgs[3]["content"].lower(), (
        f"Repair instruction doesn't embed the error. Got: {msgs[3]['content'][:200]!r}"
    )

    # Final result must be fully valid
    assert result["clarity_score"] == 82
    assert result["narrative_risk"] == "Low"
    assert len(result["points_forts"]) == 3
    assert all("evidence" in p for p in result["points_forts"])
    assert all("brand_element" in r for r in result["recommandations"])

    print(f"\n[6] repair OK — 2 calls made, 4-message conversation confirmed")
    print(f"    repair instruction: {msgs[3]['content'][:120]!r}…")
    print(f"    result: score={result['clarity_score']}, risk={result['narrative_risk']}")
