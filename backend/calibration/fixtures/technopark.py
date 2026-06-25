"""
calibration/fixtures/technopark.py — Technopark calibration fixture (DATA only).

Mirrors the Technopark brand system + 15-case suite used by the legacy
run_calibration.py / tests/test_calibration.py, so the generic harness can run
the SAME cases and prove zero regression after the brand-agnostic prompt work.
Also serves as the *second brand* for the cross-brand decoupling check.
"""

BRAND = "Technopark"
BRAND_SYSTEM_ID = 3  # client "Technopark" (id=5) — seeded by seed_technopark_direct.py

BRAND_SYSTEM = {
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
        # Jargon & réducteurs de positionnement bannis par l'identité verbale Technopark
        # (auparavant codés en dur dans le prompt — désormais portés par le brand system).
        "lieu d'incubation", "game-changing", "scale-up", "next-level", "disruptive", "disruption",
        "holistique", "synergies écosystémiques", "dans le cadre de",
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

# Repeatability: haut · ligne rouge · mid/factuel · générique-réducteur · ambigu
REPEATABILITY_IDS = ["01", "05", "12", "09", "11"]

CONTRAST_CHECKS = None  # no contrast pairs specified for Technopark
PARAPHRASES = None
