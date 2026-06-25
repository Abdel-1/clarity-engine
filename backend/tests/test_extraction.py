import pytest
import os
from dotenv import load_dotenv

# Load env variables for API keys
load_dotenv()

from app.services.brand_extractor_service import extract_brand_fields

# 1. Document complet
DOC_COMPLET = """
Nom de la marque : Acme Corp
Rôle de la marque : Fournir des enclumes de haute qualité.
Master statement : La qualité qui tombe à pic.
Priorités stratégiques : 
- Innovation
- Sécurité
Territoires narratifs : 
- Le désert
- La gravité
Ton de la marque : Humoristique et sérieux
Lignes rouges : 
- Ne jamais parler de Road Runner
Mots à privilégier : 
- Solide
- Lourd
Mots à éviter : 
- Bip Bip
Audiences clés : 
- Coyotes
Contexte sectoriel : Chasse en milieu désertique.
"""

# 2. Document partiel
DOC_PARTIEL = """
Nom de la marque : TechNova
Ton de la marque : Innovant et dynamique
Audiences clés :
- Développeurs
- CTOs
"""

# 3. Document hors-sujet
DOC_HORS_SUJET = """
Recette de la tarte aux pommes :
1. Éplucher les pommes.
2. Mettre dans la pâte.
3. Cuire à 180°C pendant 30 minutes.
"""

def test_extraction_complet():
    print("Running test_extraction_complet...")
    result = extract_brand_fields(DOC_COMPLET)
    
    assert "Acme Corp" in result["nom_marque"]
    assert "Humoristique" in result["ton_marque"]
    assert any("Coyotes" in a for a in result["audiences_cles"])
    assert any("Bip Bip" in a for a in result["mots_a_eviter"])
    
    # champs_manquants should be empty since all fields are provided
    assert len(result.get("champs_manquants", [])) == 0

def test_extraction_partiel():
    print("Running test_extraction_partiel...")
    result = extract_brand_fields(DOC_PARTIEL)
    
    assert "TechNova" in result["nom_marque"]
    assert "Innovant" in result["ton_marque"]
    assert any("Développeurs" in a for a in result["audiences_cles"])
    
    # Missing fields should be strictly empty (or empty list)
    assert result["role_marque"] == ""
    assert result["lignes_rouges"] == []
    
    # Missing fields should be accurately listed in champs_manquants
    manquants = result.get("champs_manquants", [])
    assert "role_marque" in manquants
    assert "lignes_rouges" in manquants

def test_extraction_hors_sujet():
    print("Running test_extraction_hors_sujet...")
    result = extract_brand_fields(DOC_HORS_SUJET)
    
    # All fields should be empty, no hallucination
    assert result["nom_marque"] == ""
    assert result["ton_marque"] == ""
    assert result["audiences_cles"] == []
    
    manquants = result.get("champs_manquants", [])
    # all 11 core fields should be marked as missing
    assert len(manquants) >= 10
