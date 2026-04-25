import requests, json

data = {
    "brand_name": "Technopark",
    "brand_role": (
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
    "priorities": (
        "1. Accompagnement entrepreneurial : Soutien structuré de l'idée à la croissance "
        "(incubation, accélération, accès au financement).\n"
        "2. Ancrage technologique : Expertise et infrastructures de pointe pour les écosystèmes tech et digital.\n"
        "3. Communauté active : Networking et collaboration intense entre startups, investisseurs, "
        "grands groupes et institutions.\n"
        "4. Couverture territoriale : Présence stratégique dans les différentes régions du Maroc "
        "pour un rayonnement national."
    ),
    "territories": (
        "L'écosystème entrepreneurial marocain — connecter les talents, les territoires et la technologie.\n"
        "L'innovation à impact : transformer les idées en succès mesurables.\n"
        "Le hub national de référence : seul réseau national marocain combinant accompagnement, "
        "connexion et ancrage territorial.\n"
        "La communauté et l'appartenance : fédérer startups, porteurs de projets, investisseurs "
        "et institutions autour d'une même ambition."
    ),
    "tone": (
        "Inspirant : donner envie d'agir, transmettre de l'énergie et de la conviction.\n"
        "Humain : parler des personnes avant les projets, rester accessible et chaleureux.\n"
        "Moderne : refléter l'innovation et le digital sans jargon inutile.\n"
        "Accessible : phrases directes, simples et claires.\n"
        "Fédérateur : relier entrepreneurs, institutions, investisseurs et territoires.\n"
        "Énergique : verbes d'action, lexique lié à l'impact et à la transformation."
    ),
    "red_lines": (
        "Ne jamais appeler les startups ou membres 'Locataires' → utiliser 'Membres' ou 'Startups'.\n"
        "Ne jamais parler d''Espace de bureau' → utiliser 'Hub'.\n"
        "Éviter 'Infrastructures passives' → elles sont actives et structurantes.\n"
        "Éviter 'Simple assistance' → Technopark est un partenaire, pas un prestataire.\n"
        "Ne jamais adopter un ton administratif, bureaucratique ou distant.\n"
        "Ne pas réduire Technopark à un bailleur immobilier ou un centre de coworking ordinaire."
    ),
    "words_preferred": (
        "Innovation, impact, réseau, talent, accompagner, connecter, révéler, accélérer, "
        "transformer, impulser, hub technologique, lieu de vie et d'échange, partenaire, "
        "écosystème, communauté, ancrage, rayonnement, croissance, territoire, digital, entrepreneuriat."
    ),
    "words_avoid": (
        "Locataire, espace de bureau, infrastructures passives, simple assistance, "
        "bailleur, coworking ordinaire, administratif, bureaucratique."
    ),
    "audiences": (
        "Startups en phase d'idéation, de création ou de croissance.\n"
        "Porteurs de projets technologiques et digitaux.\n"
        "TPE/PME technologiques à fort potentiel.\n"
        "Investisseurs (business angels, fonds de capital-risque).\n"
        "Grands groupes cherchant l'open innovation.\n"
        "Institutions publiques et partenaires académiques."
    ),
    "sector": "Technologie, Digital, Entrepreneuriat, Innovation",
    "created_by": "Clarity Engine — Import PDF"
}

r = requests.post("http://127.0.0.1:8000/api/brand-systems", json=data)
print(r.status_code, r.json())
