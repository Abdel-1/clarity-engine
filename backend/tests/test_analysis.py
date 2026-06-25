import pytest
import os
from dotenv import load_dotenv

load_dotenv()

# Analysis calls with the v4+ prompt can take up to 60 s; raise the per-call timeout.
os.environ.setdefault("DEEPSEEK_TIMEOUT", "90")

from app.services.brand_analysis_service import analyze, validate_analysis, _AnalysisValidationError

# Brand System de référence (Tech Premium)
BRAND_SYSTEM = {
    "nom_marque": "TechNova",
    "role_marque": "Faciliter la transition numérique des entreprises par des solutions cloud souveraines.",
    "master_statement": "TechNova : Le cloud de confiance, propulsé par l'innovation européenne.",
    "priorites_strategiques": ["Sécurité des données", "Haute disponibilité", "Souveraineté"],
    "territoires_narratifs": ["L'avenir de la souveraineté", "L'excellence technologique"],
    "ton_marque": "Expert, rassurant, institutionnel, jamais familier.",
    "lignes_rouges": ["Ne jamais promettre le risque zéro", "Ne jamais dénigrer la concurrence", "Ne jamais utiliser d'anglicismes inutiles"],
    "mots_a_privilegier": ["Souveraineté", "Résilience", "Confiance", "Partenaire"],
    "mots_a_eviter": ["Magique", "Incroyable", "Hack", "Cheap"],
    "audiences_cles": ["DSI", "RSSI", "Directions générales"],
    "contexte_sectoriel": "Marché concurrentiel avec de forts enjeux réglementaires."
}

METADATA = {
    "audience": "DSI",
    "canal": "LinkedIn",
    "objectif": "Rassurer sur la sécurité",
    "type_prise_parole": "Post Réseaux Sociaux",
    "date": "2026",
    "auteur": "TechNova Comms"
}

# 1. Parfaitement aligné
MSG_ALIGNED = {
    "titre": "Lancement de CloudResilience",
    "langue": "fr",
    "corps": "Chez TechNova, la confiance de nos partenaires est notre priorité absolue. Face aux enjeux de souveraineté numérique, nous annonçons le déploiement de notre nouvelle infrastructure haute disponibilité. Notre engagement : une résilience éprouvée et une sécurité des données au cœur de l'Europe."
}

# 2. Générique / Neutre
MSG_NEUTRAL = {
    "titre": "Mise à jour produit",
    "langue": "fr",
    "corps": "Nous avons mis à jour nos serveurs hier. Les performances sont améliorées de 10%."
}

# 3. Ligne rouge franchie
MSG_RED_LINE = {
    "titre": "TechNova bat la concurrence",
    "langue": "fr",
    "corps": "Notre cloud est 100% sans risque et magique. Zéro risque garanti ! Les concurrents sont des amateurs à côté de nous. C'est incroyable."
}

# 4. Dispersé / Multi-intentions
MSG_SCATTERED = {
    "titre": "Plein de nouveautés",
    "langue": "fr",
    "corps": "Nous lançons de nouveaux serveurs, et n'oubliez pas notre tournoi de baby-foot ce soir ! Au fait, la souveraineté c'est bien, mais on va aussi ouvrir un bureau en Asie."
}

# 5. Ton inadapté
MSG_WRONG_TONE = {
    "titre": "Coucou la team !",
    "langue": "fr",
    "corps": "Yo les DSI ! On a sorti un truc de malade pour vos données. C'est pas cheap du tout. Testez notre hack super stylé !"
}

def test_analysis_aligned():
    print("Running test_analysis_aligned...")
    res = analyze(BRAND_SYSTEM, MSG_ALIGNED, METADATA)
    assert res["clarity_score"] >= 75
    assert res["sub_alignment"] >= 15
    assert res["narrative_risk"] == "Low"

def test_analysis_neutral():
    print("Running test_analysis_neutral...")
    res = analyze(BRAND_SYSTEM, MSG_NEUTRAL, METADATA)
    # Les sous-scores devraient être moyens (~10-13)
    assert 10 <= res["sub_alignment"] <= 14 or 10 <= res["sub_narrative_contribution"] <= 14
    assert res["narrative_risk"] == "Medium"

def test_analysis_red_line():
    print("Running test_analysis_red_line...")
    res = analyze(BRAND_SYSTEM, MSG_RED_LINE, METADATA)
    # La ligne rouge (risque zéro garanti, dénigrement, mots magique) est violée
    assert res["sub_alignment"] <= 8
    assert res["narrative_risk"] == "High"

def test_analysis_scattered():
    print("Running test_analysis_scattered...")
    res = analyze(BRAND_SYSTEM, MSG_SCATTERED, METADATA)
    assert res["sub_focus"] <= 10

def test_analysis_wrong_tone():
    print("Running test_analysis_wrong_tone...")
    res = analyze(BRAND_SYSTEM, MSG_WRONG_TONE, METADATA)
    assert res["sub_tone"] <= 10
    # Le risque peut aussi être High car des mots à éviter sont utilisés
    assert res["narrative_risk"] in ["Medium", "High"]

def test_analysis_repeatability():
    print("Running test_analysis_repeatability (3 calls)...")
    res1 = analyze(BRAND_SYSTEM, MSG_ALIGNED, METADATA)
    res2 = analyze(BRAND_SYSTEM, MSG_ALIGNED, METADATA)
    res3 = analyze(BRAND_SYSTEM, MSG_ALIGNED, METADATA)
    
    for key in ["sub_lisibilite", "sub_alignment", "sub_focus", "sub_tone", "sub_narrative_contribution"]:
        scores = [res1[key], res2[key], res3[key]]
        diff = max(scores) - min(scores)
        assert diff <= 2, f"Variance on {key} is too high: {scores} (diff {diff} > 2)"
    
    assert res1["clarity_score"] == res1["sub_lisibilite"] + res1["sub_alignment"] + res1["sub_focus"] + res1["sub_tone"] + res1["sub_narrative_contribution"]


# ─────────────────────────────────────────────────────────────────────────────
# Brand-ownership notice (brand_mismatch) — deterministic, no API call.
# Validates the additive, NON-scoring flag normalisation in validate_analysis.
# ─────────────────────────────────────────────────────────────────────────────

def _valid_result(**over):
    """A minimal schema-valid LLM result dict (score 75, risk Low)."""
    base = {
        "clarity_score": 75,
        "sub_scores": {"clarity": 15, "alignment": 15, "focus": 15, "tone": 15, "narrative_contribution": 15},
        "reasoning": {k: "ok" for k in ("clarity", "alignment", "focus", "tone", "narrative_contribution")},
        "narrative_risk": "Low",
        "points_forts":   [{"text": t, "evidence": ""} for t in ("a", "b", "c")],
        "points_faibles": [{"text": t, "evidence": ""} for t in ("a", "b", "c")],
        "recommandations": [
            {"text": "a", "brand_element": "Master statement"},
            {"text": "b", "brand_element": "Ton de marque"},
            {"text": "c", "brand_element": "Priorité : Souveraineté"},
        ],
    }
    base.update(over)
    return base


def test_brand_mismatch_true_derives_named_notice():
    res = validate_analysis(_valid_result(brand_mismatch=True), brand_name="Technopark")
    assert res["brand_mismatch"] is True
    assert "Technopark" in res["brand_mismatch_note"]
    assert "appartenir" in res["brand_mismatch_note"]


def test_brand_mismatch_absent_defaults_false():
    # A response without the field (older outputs) must validate and report no mismatch.
    res = validate_analysis(_valid_result(), brand_name="Technopark")
    assert res["brand_mismatch"] is False
    assert res["brand_mismatch_note"] == ""


def test_brand_mismatch_never_changes_scores_or_risk():
    on  = validate_analysis(_valid_result(brand_mismatch=True),  brand_name="Technopark")
    off = validate_analysis(_valid_result(brand_mismatch=False), brand_name="Technopark")
    for k in ("sub_lisibilite", "sub_alignment", "sub_focus", "sub_tone",
              "sub_narrative_contribution", "clarity_score", "narrative_risk"):
        assert on[k] == off[k]
