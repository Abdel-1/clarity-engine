#!/usr/bin/env python3
"""
Standalone calibration runner — writes results to ~/Desktop/calibration_v5_result.txt
No stdout output → won't block on full /private/tmp filesystems.

Usage:
    cd clarity-engine/backend
    source venv/bin/activate
    python run_calibration.py
"""
import os, sys, json, time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
# Calibration uses a generous timeout so a THINKING-ON baseline run (for the
# before/after comparison, via DEEPSEEK_THINKING=on) doesn't falsely time out.
# The running app stays at its own DEEPSEEK_TIMEOUT (30 s).
os.environ["DEEPSEEK_TIMEOUT"] = os.environ.get("CALIB_TIMEOUT", "180")

sys.path.insert(0, str(Path(__file__).parent))
from app.services.brand_analysis_service import analyze

OUTPUT = Path.home() / "Desktop" / "calibration_v6_result.txt"

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
        "Accompagnement entrepreneurial : Soutien structuré de l'idée à la croissance (incubation, accélération, accès au financement).",
        "Ancrage technologique : Expertise et infrastructures de pointe pour les écosystèmes tech et digital.",
        "Communauté active : Networking et collaboration intense entre startups, investisseurs, grands groupes et institutions.",
        "Couverture territoriale : Présence stratégique dans les différentes régions du Maroc pour un rayonnement national.",
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

CASES = [
    {"id": "01", "canal": "Institutionnel / Film", "audience": "Grand public / institutionnel", "type": "Prise de parole corporate", "objectif": "Affirmer l'identité de marque",
     "message": "Nous sommes Technopark. Et partout au Maroc, nous faisons grandir l'innovation.",
     "sub": {"clarity": 19, "alignment": 20, "focus": 19, "tone": 19, "narrative_contribution": 20}, "global": 97, "risk": "Low"},
    {"id": "02", "canal": "LinkedIn", "audience": "Startups, investisseurs", "type": "Post réseaux sociaux", "objectif": "Présenter l'offre Technopark",
     "message": "Notre game-changing platform connects scale-ups to next-level opportunities.",
     "sub": {"clarity": 8, "alignment": 1, "focus": 10, "tone": 1, "narrative_contribution": 1}, "global": 21, "risk": "High", "redline": True},
    {"id": "03", "canal": "Site institutionnel / Communiqué", "audience": "Institutionnels, partenaires, presse", "type": "Message institutionnel", "objectif": "Affirmer la légitimité et l'ancrage historique",
     "message": "Technopark, premier hub entrepreneurial marocain, accompagne depuis 25 ans les startups et PME innovantes à l'échelle du Royaume.",
     "sub": {"clarity": 18, "alignment": 19, "focus": 17, "tone": 17, "narrative_contribution": 18}, "global": 89, "risk": "Low"},
    {"id": "04", "canal": "LinkedIn / Instagram", "audience": "Entrepreneurs, jeunes talents, grand public", "type": "Post réseaux sociaux", "objectif": "Engager, inspirer, valoriser l'écosystème",
     "message": "3 startups. 3 villes. 1 seule ambition : transformer le Maroc de l'intérieur.",
     "sub": {"clarity": 17, "alignment": 17, "focus": 18, "tone": 18, "narrative_contribution": 17}, "global": 87, "risk": "Low"},
    {"id": "05", "canal": "Communication interne / Note de direction", "audience": "Équipes internes, direction", "type": "Note interne", "objectif": "Présenter une initiative stratégique",
     "message": "Dans le cadre de notre mission d'accompagnement institutionnel, nous déployons des synergies écosystémiques.",
     "sub": {"clarity": 4, "alignment": 2, "focus": 7, "tone": 2, "narrative_contribution": 2}, "global": 17, "risk": "High", "redline": True},
    {"id": "06", "canal": "Rapport annuel / LinkedIn institutionnel", "audience": "Investisseurs, institutions, partenaires", "type": "Communication résultats", "objectif": "Démontrer l'impact concret et la crédibilité",
     "message": "En 2024, 87 startups accompagnées à travers nos 6 sites régionaux, générant plus de 400 emplois directs.",
     "sub": {"clarity": 18, "alignment": 19, "focus": 19, "tone": 15, "narrative_contribution": 19}, "global": 90, "risk": "Low"},
    {"id": "07", "canal": "Site web / À propos", "audience": "Grand public", "type": "Présentation institutionnelle", "objectif": "Décrire le rôle de Technopark",
     "message": "Nous soutenons l'innovation.",
     "sub": {"clarity": 12, "alignment": 3, "focus": 10, "tone": 8, "narrative_contribution": 3}, "global": 36, "risk": "High", "redline": True},
    {"id": "08", "canal": "Événement / Discours d'ouverture", "audience": "Entrepreneurs, partenaires, institutionnels", "type": "Prise de parole événementielle", "objectif": "Mobiliser, créer l'adhésion collective",
     "message": "L'impact commence ici. L'impact commence avec vous. L'impact commence maintenant.",
     "sub": {"clarity": 16, "alignment": 16, "focus": 17, "tone": 18, "narrative_contribution": 17}, "global": 84, "risk": "Low"},
    {"id": "09", "canal": "Site web / Présentation partenaire", "audience": "Investisseurs, institutions", "type": "Message de positionnement", "objectif": "Définir ce qu'est Technopark",
     "message": "Technopark est un lieu d'incubation pour startups.",
     "sub": {"clarity": 14, "alignment": 3, "focus": 12, "tone": 10, "narrative_contribution": 3}, "global": 42, "risk": "High", "redline": True},
    {"id": "10", "canal": "Communication partenariale / Lettre d'intention", "audience": "Partenaires institutionnels, investisseurs", "type": "Message partenarial", "objectif": "Démontrer la valeur de collaborer avec Technopark",
     "message": "Ensemble, nous connectons les talents, les territoires et la technologie pour un impact durable.",
     "sub": {"clarity": 18, "alignment": 20, "focus": 18, "tone": 18, "narrative_contribution": 19}, "global": 93, "risk": "Low"},
    {"id": "11", "canal": "Réseaux sociaux / Affichage", "audience": "Grand public, jeunes entrepreneurs", "type": "Message inspirationnel", "objectif": "Susciter l'adhésion et l'identification",
     "message": "Chaque idée mérite une chance.",
     "sub": {"clarity": 16, "alignment": 11, "focus": 14, "tone": 14, "narrative_contribution": 9}, "global": 64, "risk": "Medium"},
    {"id": "12", "canal": "Événementiel / Réseaux sociaux", "audience": "Entrepreneurs régionaux, étudiants, talents locaux", "type": "Annonce événementielle", "objectif": "Mobiliser les entrepreneurs de la région",
     "message": "Technopark Agadir organise un hackathon ouvert à tous les porteurs de projets de la région Souss-Massa.",
     "sub": {"clarity": 17, "alignment": 15, "focus": 16, "tone": 13, "narrative_contribution": 14}, "global": 75, "risk": "Low"},
    {"id": "13", "canal": "LinkedIn / Site web", "audience": "Partenaires, entreprises", "type": "Message de positionnement", "objectif": "Décrire l'approche Technopark",
     "message": "Nous créons de la valeur pour l'écosystème via une approche holistique et disruptive.",
     "sub": {"clarity": 5, "alignment": 2, "focus": 6, "tone": 2, "narrative_contribution": 2}, "global": 17, "risk": "High", "redline": True},
    {"id": "14", "canal": "Site web / Présentation", "audience": "Grand public, entrepreneurs potentiels", "type": "Message de crédibilité", "objectif": "Rassurer et crédibiliser Technopark",
     "message": "Nous soutenons les entrepreneurs depuis longtemps et avec beaucoup de succès.",
     "sub": {"clarity": 11, "alignment": 5, "focus": 10, "tone": 8, "narrative_contribution": 5}, "global": 39, "risk": "High"},
    {"id": "15", "canal": "Page d'accueil site web / Vidéo institutionnelle", "audience": "Tous publics", "type": "Message de marque central", "objectif": "Définir, différencier, inspirer",
     "message": "Technopark n'est pas seulement un lieu. C'est une communauté, un réseau, une ambition partagée. Partout au Maroc, nous aidons les entrepreneurs à transformer leurs idées en impact.",
     "sub": {"clarity": 18, "alignment": 19, "focus": 18, "tone": 18, "narrative_contribution": 19}, "global": 92, "risk": "Low"},
]

SUB_MAP = {
    "clarity": "sub_lisibilite", "alignment": "sub_alignment", "focus": "sub_focus",
    "tone": "sub_tone", "narrative_contribution": "sub_narrative_contribution",
}
REDLINE_IDS = {c["id"] for c in CASES if c.get("redline")}


def run_once(case):
    return analyze(
        TECHNOPARK_BS,
        {"titre": f"Calibration case {case['id']}", "langue": "fr", "corps": case["message"]},
        {"canal": case["canal"], "audience": case["audience"], "objectif": case["objectif"],
         "type_prise_parole": case["type"], "date": None, "auteur": "calibration-test"},
    )


def is_in_band(case, res):
    if abs(res["clarity_score"] - case["global"]) > 8: return False
    if res["narrative_risk"] != case["risk"]: return False
    for sk, dk in SUB_MAP.items():
        if abs(res[dk] - case["sub"][sk]) > 3: return False
    return True


def main():
    lines = []
    log = lambda s: lines.append(s)

    results = {}
    latencies = []                      # per-call wall-clock seconds (all runs)
    for case in CASES:
        runs = []
        for i in range(3):
            sys.stderr.write(f"  case {case['id']} run {i+1}/3 …\n")
            sys.stderr.flush()
            t0 = time.perf_counter()
            res = run_once(case)
            latencies.append(time.perf_counter() - t0)
            runs.append(res)
        results[case["id"]] = runs

    # Report table
    SHORT = {"clarity": "Cla", "alignment": "Ali", "focus": "Foc", "tone": "Ton", "narrative_contribution": "Nar"}
    col_subs = "  ".join(f"{SHORT[k]}(T→O)" for k in SUB_MAP)
    log(f"\n{'':=<132}")
    log(f"  RAPPORT DE CALIBRATION — Prompt v6  (tolérance: Δglobal ≤ 8, Δsub ≤ 3, risk exact)")
    log(f"{'':=<132}")
    log(f"{'ID':>2}  {'G_cible':>7}  {'G_obtenu':>8}  {'ΔG':>4}  {'Risk_cible':>10}  {'Risk_obt':>8}  {col_subs}  {'STATUT':>10}")
    log(f"{'':─<132}")

    all_ok = True
    failures = []
    for case in CASES:
        cid = case["id"]
        res = results[cid][0]
        g_t, g_o = case["global"], res["clarity_score"]
        dg = g_o - g_t
        rt, ro = case["risk"], res["narrative_risk"]
        sub_cols = []
        for sk, dk in SUB_MAP.items():
            t, o = case["sub"][sk], res[dk]
            d = o - t
            flag = "" if abs(d) <= 3 else "!"
            sub_cols.append(f"{t:>2}→{o:<2}{flag}")
        sub_str = "  ".join(sub_cols)
        status = "OK" if is_in_band(case, res) else "HORS BANDE"
        if status != "OK":
            all_ok = False
        risk_flag = "" if ro == rt else " !"
        log(f"{cid:>2}  {g_t:>7}  {g_o:>8}  {dg:>+4}  {rt:>10}  {ro:>8}{risk_flag}  {sub_str}  {status:>10}")

    log(f"{'':═<132}")
    log(f"  {'ALL CASES IN BAND ✓' if all_ok else 'SOME CASES OUT OF BAND — see HORS BANDE rows above'}")
    log(f"{'':=<132}")

    # Repeatability check
    log("\nREPEATABILITY CHECK (spread ≤ 1 per sub-score):")
    rep_ok = True
    for case in CASES:
        cid = case["id"]
        runs = results[cid]
        case_fails = []
        for sk, dk in SUB_MAP.items():
            vals = [r[dk] for r in runs]
            spread = max(vals) - min(vals)
            if spread > 1:
                case_fails.append(f"{sk}: {vals}, spread={spread}")
        if case_fails:
            rep_ok = False
            log(f"  [{cid}] HORS BANDE RÉPÉT: " + "; ".join(case_fails))
        else:
            log(f"  [{cid}] OK")

    log(f"\n  Répétabilité : {'OK ✓' if rep_ok else 'HORS BANDE'}")

    # ── Latency p50/p95 ───────────────────────────────────────────────────
    def _pct(sorted_vals, p):
        if not sorted_vals:
            return 0.0
        k = (len(sorted_vals) - 1) * p
        lo = int(k)
        hi = min(lo + 1, len(sorted_vals) - 1)
        return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo)

    sl = sorted(latencies)
    thinking = os.environ.get("DEEPSEEK_THINKING", "off")
    log(f"\n{'':=<132}")
    log(f"  LATENCE — {len(sl)} appels · thinking={thinking} · model=deepseek-v4-pro")
    log(f"{'':─<132}")
    if sl:
        log(f"  p50 = {_pct(sl, 0.50):6.2f}s    p95 = {_pct(sl, 0.95):6.2f}s    "
            f"min = {sl[0]:6.2f}s    max = {sl[-1]:6.2f}s    moyenne = {sum(sl)/len(sl):6.2f}s")
    log(f"{'':=<132}")

    # Write to file
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    sys.stderr.write(f"\nReport written to: {OUTPUT}\n")

    # Exit code
    sys.exit(0 if (all_ok and rep_ok) else 1)


if __name__ == "__main__":
    main()
