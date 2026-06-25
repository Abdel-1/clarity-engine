"""
calibration/seed_mg_maroc.py — seed/refresh the MG Maroc brand system in the DB.

Mirrors seed_technopark_direct.py: a DISTINCT client ("MG Maroc") and its brand
system row, written from the blueprint-accurate fixture (calibration.fixtures
.mg_maroc.BRAND_SYSTEM). Does NOT touch Technopark. Idempotent: creates the row
if missing, otherwise refreshes it in place so the DB matches the fixture.

List fields are stored newline-joined so _bs_row_to_v1 / parse_list round-trips
them back to proper multi-item lists (DB path ≡ fixture dict).

Usage:
    cd clarity-engine/backend && source venv/bin/activate
    python -m calibration.seed_mg_maroc
"""
from app.db.session import SessionLocal
from app.db.models.brand_system import BrandSystem
from app.db.models.client import Client
from calibration.fixtures import mg_maroc as fx

_BS = fx.BRAND_SYSTEM


def _join(v):
    return "\n".join(v) if isinstance(v, list) else (v or "")


def _row_fields():
    return {
        "brand_name":       _BS["nom_marque"],
        "brand_role":       _BS["role_marque"],
        "master_statement": _BS["master_statement"],
        "priorities":       _join(_BS["priorites_strategiques"]),
        "territories":      _join(_BS["territoires_narratifs"]),
        "tone":             _BS["ton_marque"],
        "red_lines":        _join(_BS["lignes_rouges"]),
        "words_preferred":  _join(_BS["mots_a_privilegier"]),
        "words_avoid":      _join(_BS["mots_a_eviter"]),
        "audiences":        _join(_BS["audiences_cles"]),
        "sector":           _BS["contexte_sectoriel"],
        "created_by":       "Calibration Seed (MG Maroc)",
        "is_active":        True,
    }


def seed_mg():
    db = SessionLocal()
    try:
        client = db.query(Client).filter(Client.company_name == "MG Maroc").first()
        if not client:
            client = Client(company_name="MG Maroc", sector="Automobile")
            db.add(client); db.commit(); db.refresh(client)
            print(f"✅ Client 'MG Maroc' créé (id={client.id}).")
        else:
            print(f"ℹ️ Client 'MG Maroc' déjà présent (id={client.id}).")

        fields = _row_fields()
        existing = (
            db.query(BrandSystem)
            .filter(BrandSystem.client_id == client.id)
            .order_by(BrandSystem.id.asc())
            .first()
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            existing.version = (existing.version or 1)
            db.commit()
            print(f"♻️  Brand system MG rafraîchi en place (id={existing.id}) — blueprint-accurate.")
            bs_id = existing.id
        else:
            bs = BrandSystem(client_id=client.id, version=1, **fields)
            db.add(bs); db.commit(); db.refresh(bs)
            print(f"✅ Brand system MG créé (id={bs.id}).")
            bs_id = bs.id

        if bs_id != fx.BRAND_SYSTEM_ID:
            print(f"⚠️  Note: fixture BRAND_SYSTEM_ID={fx.BRAND_SYSTEM_ID} mais row id={bs_id}. "
                  f"Mets à jour calibration/fixtures/mg_maroc.py:BRAND_SYSTEM_ID = {bs_id}.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_mg()
