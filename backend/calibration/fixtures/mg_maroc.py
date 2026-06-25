"""
calibration/fixtures/mg_maroc.py — MG Maroc calibration fixture (DATA only).

Pure brand-specific data: the MG Maroc brand system (derived verbatim from
BS/MG_Maroc_Blueprint_VAM.pdf), the 20-case suite with expected scores, and the
stability/coherence inputs. Contains NO scoring logic — the generic harness
(calibration/harness.py) consumes this and is identical for every brand.

`BRAND_SYSTEM_ID` points at the row seeded by calibration/seed_mg_maroc.py; the
runner can load the brand system from the DB by id, or use BRAND_SYSTEM below.
"""

BRAND = "MG Maroc"
BRAND_SYSTEM_ID = 4  # client "MG Maroc" (id=6) — see calibration/seed_mg_maroc.py

# ─────────────────────────────────────────────────────────────────────────────
# MG MAROC BRAND SYSTEM  (v1 schema dict — the only MG-specific *input*)
# ─────────────────────────────────────────────────────────────────────────────
BRAND_SYSTEM = {
    "nom_marque": "MG Maroc",
    "role_marque": (
        "Constructeur automobile à héritage britannique (né en 1924 à Oxford), MG incarne "
        "« Passion for Progress » : rendre la modernité désirable et accessible au Maroc. "
        "MG vise à devenir la référence de la mobilité accessible, désirable et rassurante — "
        "la marque qui prouve que modernité et fiabilité ne sont pas incompatibles. "
        "Positionnement : « L'upgrade accessible, l'esprit tranquille »."
    ),
    "master_statement": (
        "Passion for Progress — Driven by Passion. Powered by Progress.\n"
        "L'upgrade accessible, l'esprit tranquille.\n"
        "MG n'est pas une marque qui promet. MG est une marque qui fait avancer.\n"
        "La modernité qui tient."
    ),
    "priorites_strategiques": [
        "Incarner Passion for Progress : le progrès utile (améliorer, simplifier, optimiser la vie réelle), "
        "jamais l'effet vitrine ni le bruit.",
        "Porter un code culturel britannique distinct : understated confidence, sobre et percutant "
        "(ADN design né en 1924 à Oxford).",
        "Rassurer par la preuve : réseau, SAV certifié, disponibilité des pièces, garantie 7 ans, "
        "transparence totale. La confiance ne se déclare pas, elle se prouve.",
        "Élever les standards de mobilité : hybride désirable, upgrade perceptible, valeur dans le "
        "temps (programme de reprise VO officiel).",
        "Répondre proactivement à l'objection « marque chinoise » : assumer l'ADN britannique + "
        "l'ingénierie mondiale + des preuves tangibles, jamais sur la défensive.",
    ],
    "territoires_narratifs": [
        "Accessible Progress — Move Up : l'upgrade accessible SANS compromis ; le progrès n'est pas "
        "réservé à une élite.",
        "Confidence Over Time : la confiance ne se déclare pas, elle se prouve (réseau, SAV, pièces, "
        "garantie 7 ans, reprise VO). La modernité qui tient.",
        "Useful Innovation : l'hybride et les équipements qui améliorent la vie réelle — pas du gadget.",
        "Understated British Style : sobriété, élégance discrète. On ne crie pas, on prouve. "
        "Le Cyberster sert de halo et tire toute la gamme vers le haut.",
        "Désir d'abord, preuve ensuite : on fait vouloir puis on rassure ; un choix socialement "
        "valorisant et assumé, pas un achat défensif.",
        "Ancrage vie réelle marocaine : situations reconnaissables, de Casa à Agadir.",
    ],
    "ton_marque": (
        "Clair : direct, sans jargon ; on énonce les faits.\n"
        "Élégant : British understated, sobre, jamais clinquant. On ne crie pas, on prouve.\n"
        "Ancré : vie réelle marocaine, situations reconnaissables.\n"
        "Factuel : 1 preuve + 1 avantage par création.\n"
        "Principe fondateur : l'émotion d'abord, la preuve ensuite — on fait vouloir, puis on "
        "rassure, jamais l'inverse. Le discours MG ne commence pas par les specs."
    ),
    "lignes_rouges": [
        "Ne jamais dire « Made in China » ni définir MG par la Chine ; l'origine assumée est "
        "britannique (1924, Oxford), l'ingénierie est mondiale.",
        "Jamais de ton défensif ou réactif sur l'origine (« contrairement à ce qu'on dit », "
        "« ne vous inquiétez pas », « ce n'est pas grave ») : la posture est proactive, pas une justification.",
        "Pas de superlatifs sans preuve ni de langage promo clinquant : « offre choc », « prix cassé », "
        "« incroyable », « imbattable », « la meilleure », « dernier jour !!! », « à ne pas rater », « cadeau ».",
        "Ne jamais positionner MG comme « pas chère » / low-cost dévalorisant ni comme un achat défensif : "
        "MG est l'upgrade accessible SANS compromis, le choix assumé.",
        "Ne pas céder au registre clinquant / hurlant (majuscules criardes, emojis 🔥, hype) : "
        "c'est l'exact opposé du British understated.",
    ],
    "mots_a_privilegier": [
        "Avancer", "Upgrade", "Passer un cap", "S'installer", "Sans compromis", "Le choix assumé",
        "Maîtriser", "Distinctif", "Rare au Maroc", "Ce qu'on ne regrette pas", "Esprit tranquille",
        "La modernité qui tient", "Hybride malin", "Hybride utile", "Full équipé", "Garantie 7 ans",
        "Réseau SAV certifié", "Pièces disponibles", "Reprise VO", "Héritage britannique",
        "Passion for Progress", "Confiance prouvée", "Valeur dans le temps",
    ],
    "mots_a_eviter": [
        "Made in China", "marque chinoise (sur la défensive)", "offre choc", "prix cassé",
        "incroyable", "imbattable", "la meilleure", "le meilleur", "dernier jour", "à ne pas rater",
        "cadeau", "pas chère", "low-cost", "superlatifs sans preuve", "ne vous inquiétez pas",
        "ce n'est pas grave",
    ],
    "audiences_cles": [
        "L'Achiever Urbain (MG3 · Move Up) — 25-35 ans, cadre/entrepreneur à Casablanca ou Rabat, "
        "premier achat de véhicule neuf ; désir : progresser sans se piéger financièrement ; "
        "frein : mauvais choix, coût total, regard des pairs.",
        "La Famille Installée (MG HS · Settle In) — 30-45 ans, CSP+, remplacement familial ; "
        "désir : sérénité, espace, technologie utile ; frein : panne, SAV loin, valeur de revente.",
        "Le Passion Collector (Cyberster · Feel Again) — 35-50 ans CSP+ early adopter, "
        "Marrakech/Casablanca, achat plaisir ; désir : icône, émotion, distinction sans folklore ; "
        "frein : crédibilité « plaisir », originalité perçue.",
    ],
    "contexte_sectoriel": (
        "Automobile / mobilité au Maroc — véhicules hybrides et électriques ; forte concurrence des "
        "marques chinoises (Chery/Omoda, BYD, Geely). Enjeux : désirabilité + preuve de durabilité "
        "(revente, SAV)."
    ),
}

# ─────────────────────────────────────────────────────────────────────────────
# 20-CASE SUITE — sub = C(clarity) A(alignment) F(focus) T(tone) N(narrative)
# ─────────────────────────────────────────────────────────────────────────────
CASES = [
    {"id": "01", "canal": "Film institutionnel", "audience": "Grand public / institutionnel",
     "type": "Prise de parole corporate", "objectif": "Affirmer l'identité de marque",
     "message": "MG n'est pas une marque qui promet. MG est une marque qui fait avancer. Driven by Passion. Powered by Progress.",
     "sub": {"clarity": 18, "alignment": 20, "focus": 18, "tone": 19, "narrative_contribution": 20}, "global": 95, "risk": "Low"},

    {"id": "02", "canal": "FAQ / Réponse objection", "audience": "Prospects",
     "type": "Réponse à objection", "objectif": "Répondre à l'objection « marque chinoise »",
     "message": "Notre ADN est britannique, né à Oxford en 1924. Notre ingénierie est mondiale. La modernité qui tient : 7 ans de garantie, un réseau SAV certifié, des pièces disponibles.",
     "sub": {"clarity": 18, "alignment": 19, "focus": 17, "tone": 18, "narrative_contribution": 18}, "global": 90, "risk": "Low"},

    {"id": "03", "canal": "Campagne MG3", "audience": "L'Achiever Urbain (25-35)",
     "type": "Campagne produit", "objectif": "Faire désirer et rassurer",
     "message": "Passez un cap, sans compromis. La MG3 hybride a le style qu'on remarque et le bon sens qu'on apprécie : full équipée, hybride malin, et 7 ans de garantie pour rouler l'esprit tranquille.",
     "sub": {"clarity": 17, "alignment": 18, "focus": 17, "tone": 18, "narrative_contribution": 17}, "global": 87, "risk": "Low"},

    {"id": "04", "canal": "PR / Instagram", "audience": "Le Passion Collector",
     "type": "Post réseaux sociaux / PR", "objectif": "Halo de marque (désirabilité)",
     "message": "Le Cyberster, c'est le plaisir à l'état pur. Un roadster britannique qui ne cherche pas à crier : il suffit de le voir passer.",
     "sub": {"clarity": 17, "alignment": 18, "focus": 18, "tone": 19, "narrative_contribution": 17}, "global": 89, "risk": "Low"},

    {"id": "05", "canal": "Showroom / HS", "audience": "La Famille Installée",
     "type": "Argumentaire showroom", "objectif": "Rassurer et faire désirer",
     "message": "Pour votre famille, la sérénité ne s'improvise pas. Le MG HS, c'est l'espace et la technologie utile, avec un réseau proche et 7 ans de garantie. La modernité qui tient.",
     "sub": {"clarity": 18, "alignment": 18, "focus": 17, "tone": 17, "narrative_contribution": 18}, "global": 88, "risk": "Low"},

    {"id": "06", "canal": "Page d'accueil / Film", "audience": "Tous publics",
     "type": "Message de marque central", "objectif": "Définir, différencier, rassurer",
     "message": "MG, c'est l'upgrade accessible, l'esprit tranquille. Un héritage britannique né en 1924, une hybride utile, et la confiance qui se prouve : réseau, SAV, garantie 7 ans. Le progrès, sans compromis.",
     "sub": {"clarity": 17, "alignment": 19, "focus": 17, "tone": 18, "narrative_contribution": 19}, "global": 90, "risk": "Low"},

    {"id": "07", "canal": "Site / Réassurance revente", "audience": "Acheteurs",
     "type": "Message de réassurance", "objectif": "Lever le frein de la revente",
     "message": "Avancer sans regret, c'est aussi savoir ce que vaut votre voiture demain. Avec le programme de reprise officiel MG et la garantie 7 ans, votre MG garde sa valeur dans le temps.",
     "sub": {"clarity": 17, "alignment": 18, "focus": 17, "tone": 16, "narrative_contribution": 17}, "global": 85, "risk": "Low"},

    {"id": "08", "canal": "Post promo (social)", "audience": "Grand public",
     "type": "Post promotionnel", "objectif": "Vendre",
     "message": "OFFRE CHOC ! Prix cassé sur la MG3, imbattable, à ne pas rater — dernier jour !!! La meilleure voiture du marché, incroyable !",
     "sub": {"clarity": 7, "alignment": 1, "focus": 8, "tone": 1, "narrative_contribution": 1}, "global": 18, "risk": "High", "redline": True},

    {"id": "09", "canal": "Réponse commentaire (social)", "audience": "Grand public / prospects",
     "type": "Réponse commentaire", "objectif": "Rassurer sur l'origine",
     "message": "Contrairement à ce qu'on dit, MG n'est pas vraiment une marque chinoise. Ne vous inquiétez pas pour la qualité, nos voitures sont fiables.",
     "sub": {"clarity": 13, "alignment": 4, "focus": 10, "tone": 7, "narrative_contribution": 5}, "global": 39, "risk": "High", "redline": True},

    {"id": "10", "canal": "FAQ / Réponse", "audience": "Prospects",
     "type": "Réponse FAQ", "objectif": "Rassurer sur l'origine",
     "message": "Oui, MG est Made in China, mais ce n'est pas grave, les voitures chinoises sont devenues très bien maintenant.",
     "sub": {"clarity": 12, "alignment": 2, "focus": 9, "tone": 6, "narrative_contribution": 4}, "global": 33, "risk": "High", "redline": True},

    {"id": "11", "canal": "Bannière", "audience": "Grand public",
     "type": "Bannière awareness", "objectif": "Awareness",
     "message": "MG, tout simplement la meilleure marque automobile du Maroc. Des voitures incroyables, un design imbattable. Vous allez adorer.",
     "sub": {"clarity": 13, "alignment": 3, "focus": 11, "tone": 5, "narrative_contribution": 3}, "global": 35, "risk": "High", "redline": True},

    {"id": "12", "canal": "Bannière site", "audience": "Grand public",
     "type": "Bannière site", "objectif": "Inciter à la visite en concession",
     "message": "Découvrez nos véhicules. Qualité, confort et performance au rendez-vous. Venez nous rendre visite en concession.",
     "sub": {"clarity": 14, "alignment": 4, "focus": 11, "tone": 9, "narrative_contribution": 3}, "global": 41, "risk": "High"},

    {"id": "13", "canal": "Page À propos", "audience": "Grand public",
     "type": "Présentation institutionnelle", "objectif": "Rassurer / crédibiliser",
     "message": "MG est une marque fiable et appréciée, qui propose de très bonnes voitures depuis longtemps.",
     "sub": {"clarity": 13, "alignment": 6, "focus": 11, "tone": 9, "narrative_contribution": 5}, "global": 44, "risk": "High"},

    {"id": "14", "canal": "Annonce produit", "audience": "Prospects / Passion Collector",
     "type": "Annonce produit", "objectif": "Informer",
     "message": "MG Cyberster au Maroc : roadster électrique 510 ch, 443 km d'autonomie, portes en élytre, à partir de 680 000 DHS.",
     "sub": {"clarity": 16, "alignment": 9, "focus": 16, "tone": 12, "narrative_contribution": 9}, "global": 62, "risk": "Medium"},

    {"id": "15", "canal": "Affichage", "audience": "Grand public",
     "type": "Affichage", "objectif": "Inspirer",
     "message": "Avancez. Élevez votre quotidien. Le progrès est à portée.",
     "sub": {"clarity": 16, "alignment": 11, "focus": 14, "tone": 14, "narrative_contribution": 9}, "global": 64, "risk": "Medium"},

    {"id": "16", "canal": "Social / Campagne", "audience": "L'Achiever Urbain",
     "type": "Post campagne", "objectif": "Faire désirer",
     "message": "La nouvelle MG3, c'est le choix assumé : du style, de l'hybride malin, et une offre vraiment imbattable cette saison.",
     "sub": {"clarity": 15, "alignment": 4, "focus": 13, "tone": 8, "narrative_contribution": 7}, "global": 47, "risk": "High", "redline": True},

    {"id": "17", "canal": "Fiche produit / Site", "audience": "La Famille Installée",
     "type": "Fiche produit", "objectif": "Informer",
     "message": "Garantie 7 ans, réseau SAV certifié, pièces disponibles : la MG HS est conçue pour durer. Un SUV hybride spacieux pour toute la famille.",
     "sub": {"clarity": 17, "alignment": 11, "focus": 15, "tone": 13, "narrative_contribution": 11}, "global": 67, "risk": "Medium"},

    {"id": "18", "canal": "Social", "audience": "Grand public",
     "type": "Post réseaux sociaux", "objectif": "Awareness",
     "message": "Le Cyberster va TOUT exploser ! Le roadster le plus fou, le plus stylé, le plus incroyable jamais vu au Maroc 🔥🔥",
     "sub": {"clarity": 13, "alignment": 3, "focus": 12, "tone": 1, "narrative_contribution": 5}, "global": 34, "risk": "High", "redline": True},

    {"id": "19", "canal": "Social", "audience": "Grand public",
     "type": "Post réseaux sociaux", "objectif": "Attirer",
     "message": "Pas besoin de se ruiner : MG, c'est la voiture pas chère qui fait le job, pour ceux qui n'ont pas les moyens d'une vraie marque.",
     "sub": {"clarity": 14, "alignment": 2, "focus": 12, "tone": 6, "narrative_contribution": 3}, "global": 37, "risk": "High", "redline": True},

    {"id": "20", "canal": "Social / National", "audience": "Grand public marocain",
     "type": "Post réseaux sociaux", "objectif": "Faire désirer et ancrer",
     "message": "De Casa à Agadir, la MG3 hybride avance avec vous : moins de carburant, plus de style, et un SAV qui répond présent. Passez un cap, l'esprit tranquille.",
     "sub": {"clarity": 18, "alignment": 18, "focus": 17, "tone": 18, "narrative_contribution": 18}, "global": 89, "risk": "Low"},
]

# ─────────────────────────────────────────────────────────────────────────────
# STABILITY / COHERENCE INPUTS (consumed by the generic harness)
# ─────────────────────────────────────────────────────────────────────────────

# Repeatability: 5 varied cases (haut · mid · ligne rouge · générique · ambigu)
REPEATABILITY_IDS = ["01", "17", "16", "12", "15"]

# Paraphrase robustness: same meaning reworded 3× → global must stay within ±3.
PARAPHRASES = {
    "label": "Message central MG reformulé 3× (même sens)",
    "meta": {"canal": "Page d'accueil / Film", "audience": "Tous publics",
             "objectif": "Définir, différencier, rassurer", "type": "Message de marque central"},
    "variants": [
        "MG, c'est l'upgrade accessible et l'esprit tranquille : un héritage britannique de 1924, "
        "une hybride utile, et la confiance qui se prouve par le réseau, le SAV et 7 ans de garantie.",
        "Avec MG, vous passez un cap sans compromis : des racines britanniques depuis 1924, "
        "une motorisation hybride utile, et une confiance prouvée — réseau, SAV et garantie 7 ans.",
        "L'esprit tranquille et un vrai upgrade accessible : voilà MG. Né britannique en 1924, "
        "hybride malin, et une fiabilité démontrée par son réseau, son SAV et ses 7 ans de garantie.",
    ],
    "target_global": 90,   # reference; harness only enforces spread ≤ 3 across the variants
}

# Metadata-sensitivity: SAME message, DIFFERENT canal/type/audience → scores must
# diverge (proves the engine reads metadata, not only the text).
_TEASER = ("Le Cyberster, c'est le plaisir à l'état pur. Un roadster britannique qui ne cherche pas "
           "à crier : il suffit de le voir passer.")
_FACTUEL = ("MG Maroc lance le Cyberster, roadster électrique 510 ch et 443 km d'autonomie, à partir "
            "de 680 000 DHS, disponible dans le réseau certifié.")
_FAMILLE = ("Pour votre famille, la sérénité ne s'improvise pas. Le MG HS, c'est l'espace et la "
            "technologie utile, avec un réseau proche et 7 ans de garantie. La modernité qui tient.")


def CHANNEL_TESTS():
    g = lambda r: r["clarity_score"]
    t = lambda r: r["sub_tone"]
    return [
        {"label": "A) Teaser émotionnel — PR/Instagram vs Communiqué (global doit diverger ≥ 10)",
         "message": _TEASER,
         "arms": [
             {"name": "PR / Instagram", "meta": {"canal": "PR / Instagram", "type": "Post désirabilité",
              "audience": "Le Passion Collector", "objectif": "Halo de marque (désirabilité)"}},
             {"name": "Communiqué presse", "meta": {"canal": "Communiqué de presse", "type": "Communiqué de presse",
              "audience": "Presse / journalistes", "objectif": "Annoncer une actualité produit"}},
         ],
         "assert": lambda r: (g(r["PR / Instagram"]) - g(r["Communiqué presse"]) >= 10,
                              f"global PR={g(r['PR / Instagram'])} − communiqué={g(r['Communiqué presse'])} "
                              f"= {g(r['PR / Instagram']) - g(r['Communiqué presse'])} (attendu ≥ 10)")},
        {"label": "B) Message factuel — Communiqué vs Instagram (Tone communiqué − Instagram ≥ 3)",
         "message": _FACTUEL,
         "arms": [
             {"name": "Communiqué presse", "meta": {"canal": "Communiqué de presse", "type": "Communiqué de presse",
              "audience": "Presse / journalistes", "objectif": "Annoncer une actualité produit"}},
             {"name": "Instagram", "meta": {"canal": "Instagram", "type": "Post désirabilité",
              "audience": "Grand public", "objectif": "Désirabilité / awareness"}},
         ],
         "assert": lambda r: (t(r["Communiqué presse"]) - t(r["Instagram"]) >= 3,
                              f"Tone communiqué={t(r['Communiqué presse'])} − Instagram={t(r['Instagram'])} "
                              f"= {t(r['Communiqué presse']) - t(r['Instagram'])} (attendu ≥ 3)")},
        {"label": "C) Sensibilité audience — message famille pour Famille vs Passion Collector (global Famille > Collector)",
         "message": _FAMILLE,
         "arms": [
             {"name": "Audience Famille", "meta": {"canal": "Showroom / HS", "type": "Argumentaire showroom",
              "audience": "La Famille Installée", "objectif": "Rassurer et faire désirer"}},
             {"name": "Audience Collector", "meta": {"canal": "Showroom / HS", "type": "Argumentaire showroom",
              "audience": "Le Passion Collector — achat plaisir, icône, distinction", "objectif": "Rassurer et faire désirer"}},
         ],
         "assert": lambda r: (g(r["Audience Famille"]) > g(r["Audience Collector"]),
                              f"global Famille={g(r['Audience Famille'])} vs Collector={g(r['Audience Collector'])}")},
    ]


# Contrast pairs (coherence, not just numbers). Each predicate receives a helper
# `r(id, field)` and returns (ok, detail). Logic lives here because the *expected
# relationships* are part of MG's calibration spec, not the engine.
def CONTRAST_CHECKS(r):
    g = lambda cid: r(cid, "clarity_score")
    t = lambda cid: r(cid, "sub_tone")
    return [
        ("#02 objection assumée  ≫  #09 objection défensive (global, écart ≥ 30)",
         g("02") - g("09") >= 30, f"#02={g('02')} − #09={g('09')} = {g('02')-g('09')}"),
        ("#02 objection assumée  ≫  #10 « Made in China » (global, écart ≥ 30)",
         g("02") - g("10") >= 30, f"#02={g('02')} − #10={g('10')} = {g('02')-g('10')}"),
        ("Tone(#04 Cyberster sobre)  −  Tone(#18 Cyberster clinquant)  ≥ 10",
         t("04") - t("18") >= 10, f"Tone #04={t('04')} − #18={t('18')} = {t('04')-t('18')}"),
        ("#05/#03 (émotion+preuve, Low)  >  #14/#17 (preuve sans émotion, Medium)",
         min(g("03"), g("05")) > max(g("14"), g("17")),
         f"min(L)={min(g('03'),g('05'))} vs max(M)={max(g('14'),g('17'))}"),
        ("#14/#17 (Medium)  >  #08/#11 (hype, High)",
         min(g("14"), g("17")) > max(g("08"), g("11")),
         f"min(M)={min(g('14'),g('17'))} vs max(H)={max(g('08'),g('11'))}"),
    ]
