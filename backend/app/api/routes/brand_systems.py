import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_client, require_admin
from app.db.models.user import User, ROLE_ADMIN
from app.db.models.brand_system import BrandSystem
from app.db.models.client import Client
from app.services.document_extractor import extract_text
from app.services.brand_extractor_service import extract_brand_fields

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



@router.post("/brand-systems", status_code=201)
def create_brand_system(
    payload: BrandSystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: create a brand system scoped to the admin's chosen client."""
    # client_id must come from a follow-up or be supplied externally;
    # use the first active client as a safe default for direct API use.
    from app.db.models.client import Client as _Client
    client = db.query(_Client).first()
    if not client:
        raise HTTPException(status_code=400, detail="No client exists yet. Create a client first.")
    bs = BrandSystem(client_id=client.id, **payload.dict())
    db.add(bs); db.commit(); db.refresh(bs)
    return {"id": bs.id, "brand_name": bs.brand_name, "version": bs.version}


@router.post("/brand-systems/import")
async def import_brand_system(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """Upload brand documents → extract text → AI parses brand fields → return for review."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    extracted_parts = []
    file_names = []
    errors = []

    for f in files:
        content = await f.read()
        if not content:
            errors.append(f"{f.filename}: empty file")
            continue
        try:
            text = extract_text(f.filename or "file", content)
            if text.strip():
                extracted_parts.append(f"=== {f.filename} ===\n{text}")
                file_names.append(f.filename)
            else:
                errors.append(f"{f.filename}: no text could be extracted")
        except ValueError as e:
            errors.append(f"{f.filename}: {str(e)}")

    if not extracted_parts:
        raise HTTPException(
            status_code=422,
            detail=f"No text could be extracted from the uploaded files. {'; '.join(errors)}"
        )

    combined = "\n\n".join(extracted_parts)
    char_count = len(combined)

    try:
        brand_data = extract_brand_fields(combined)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": "extracted",
        "sources": file_names,
        "char_count": char_count,
        "errors": errors,
        "data": brand_data,
    }


@router.get("/brand-systems")
def list_brand_systems(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    q = db.query(BrandSystem).filter(BrandSystem.is_active == True)
    # Client users only see their own brand systems
    if current_user.role != ROLE_ADMIN:
        q = q.filter(BrandSystem.client_id == current_user.client_id)
    rows = q.all()
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
def update_brand_system(
    bs_id: int,
    payload: BrandSystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: update any brand system."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(bs, k, v)
    bs.version += 1
    db.commit(); db.refresh(bs)
    return {"id": bs.id, "version": bs.version}
