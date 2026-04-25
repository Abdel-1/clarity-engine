import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies.db import get_db
from app.db.models.brand_system import BrandSystem
from app.db.models.client import Client

router = APIRouter()


class BrandSystemCreate(BaseModel):
    brand_name:       str
    brand_role:       str
    master_statement: str
    priorities:       str
    territories:      str
    tone:             str
    red_lines:        str
    words_preferred:  Optional[str] = None
    words_avoid:      Optional[str] = None
    audiences:        Optional[str] = None
    sector:           Optional[str] = None
    created_by:       Optional[str] = None


def _get_or_create_default_client(db: Session) -> int:
    client = db.query(Client).first()
    if not client:
        client = Client(company_name="Default")
        db.add(client); db.commit(); db.refresh(client)
    return client.id


@router.post("/brand-systems", status_code=201)
def create_brand_system(payload: BrandSystemCreate, db: Session = Depends(get_db)):
    client_id = _get_or_create_default_client(db)
    bs = BrandSystem(client_id=client_id, **payload.dict())
    db.add(bs); db.commit(); db.refresh(bs)
    return {"id": bs.id, "brand_name": bs.brand_name, "version": bs.version}


@router.get("/brand-systems")
def list_brand_systems(db: Session = Depends(get_db)):
    rows = db.query(BrandSystem).filter(BrandSystem.is_active == True).all()
    return [
        {
            "id": r.id, "brand_name": r.brand_name, "version": r.version,
            "sector": r.sector, "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/brand-systems/{bs_id}")
def get_brand_system(bs_id: int, db: Session = Depends(get_db)):
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    return {c.name: getattr(bs, c.name) for c in bs.__table__.columns}


@router.put("/brand-systems/{bs_id}")
def update_brand_system(bs_id: int, payload: BrandSystemCreate, db: Session = Depends(get_db)):
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(bs, k, v)
    bs.version += 1
    db.commit(); db.refresh(bs)
    return {"id": bs.id, "version": bs.version}
