import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, List, Union

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_client, require_admin
from app.db.models.user import User, ROLE_ADMIN
from app.db.models.brand_system import BrandSystem
from app.db.models.client import Client
from app.services.document_extractor import extract_text
from app.services.brand_extractor_service import extract_brand_fields, map_to_db_fields

logger = logging.getLogger(__name__)

router = APIRouter()

# Upload guards (defence against memory exhaustion / decompression bombs and
# runaway LLM token cost). Brand documents are small; these ceilings are generous.
MAX_UPLOAD_BYTES = 15 * 1024 * 1024   # 15 MB per file
MAX_UPLOAD_FILES = 10                 # per request


class BrandSystemCreate(BaseModel):
    brand_name:       str
    brand_role:       Optional[str] = ""
    master_statement: Optional[str] = ""
    priorities:       Optional[str] = ""
    territories:      Optional[str] = ""
    tone:             Optional[str] = ""
    red_lines:        Optional[str] = ""
    words_preferred:  Optional[str] = ""
    words_avoid:      Optional[str] = ""
    audiences:        Optional[str] = ""
    sector:           Optional[str] = ""
    created_by:       Optional[str] = None
    source_file:      Optional[str] = None
    raw_extraction_json: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# POST /brand-system/extract  ← new primary extraction endpoint
# Accepts files → extracts text → calls DeepSeek → returns v1 schema JSON
# The front-end uses this to pre-fill the review form.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/brand-system/extract")
async def extract_brand_system(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Upload brand documents → extract text → DeepSeek extracts brand fields.
    Returns the raw v1 extraction schema for frontend review.
    DOES NOT persist anything — human validation required before saving.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Trop de fichiers (max {MAX_UPLOAD_FILES}).")

    extracted_parts: list[str] = []
    file_names:      list[str] = []
    errors:          list[str] = []

    for f in files:
        content = await f.read()
        if not content:
            errors.append(f"{f.filename}: fichier vide")
            continue
        if len(content) > MAX_UPLOAD_BYTES:
            errors.append(f"{f.filename}: fichier trop volumineux (max {MAX_UPLOAD_BYTES // (1024 * 1024)} Mo)")
            continue
        try:
            text = extract_text(f.filename or "file", content)
            if text.strip():
                extracted_parts.append(f"=== {f.filename} ===\n{text}")
                file_names.append(f.filename)
            else:
                errors.append(f"{f.filename}: aucun texte extrait")
        except ValueError as e:
            errors.append(f"{f.filename}: {str(e)}")

    if not extracted_parts:
        raise HTTPException(
            status_code=422,
            detail=f"Impossible d'extraire du texte. {'; '.join(errors)}"
        )

    combined    = "\n\n".join(extracted_parts)
    char_count  = len(combined)

    try:
        brand_data = extract_brand_fields(combined)
    except ValueError:
        logger.exception("Brand extraction failed")
        raise HTTPException(
            status_code=502,
            detail="L'extraction du Brand System a échoué (service d'IA indisponible). Réessayez.",
        )

    return {
        "status":            "extracted",
        "extraction_version": brand_data.pop("extraction_version", 1),
        "sources":           file_names,
        "char_count":        char_count,
        "errors":            errors,
        "data":              brand_data,   # v1 schema with champs_manquants
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /brand-systems/import  ← legacy endpoint (kept for backward compat)
# Kept so existing callers don't break; internally delegates to same service.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/brand-systems/import")
async def import_brand_system(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Legacy upload endpoint — kept for backward compatibility.
    Now delegates to the same extraction service and returns mapped DB fields
    in 'data' for backward-compatible consumers.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_UPLOAD_FILES:
        raise HTTPException(status_code=400, detail=f"Too many files (max {MAX_UPLOAD_FILES}).")

    extracted_parts: list[str] = []
    file_names:      list[str] = []
    errors:          list[str] = []

    for f in files:
        content = await f.read()
        if not content:
            errors.append(f"{f.filename}: empty file")
            continue
        if len(content) > MAX_UPLOAD_BYTES:
            errors.append(f"{f.filename}: file too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)")
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

    combined   = "\n\n".join(extracted_parts)
    char_count = len(combined)

    try:
        brand_data = extract_brand_fields(combined)
    except ValueError:
        logger.exception("Brand extraction failed")
        raise HTTPException(
            status_code=502,
            detail="L'extraction du Brand System a échoué (service d'IA indisponible). Réessayez.",
        )

    brand_data.pop("extraction_version", None)

    return {
        "status":    "extracted",
        "sources":   file_names,
        "char_count": char_count,
        "errors":    errors,
        "data":      map_to_db_fields(brand_data),  # legacy flat format
    }


# ─────────────────────────────────────────────────────────────────────────────
# Standard CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/brand-systems", status_code=201)
def create_brand_system(
    payload: BrandSystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a brand system scoped to the authenticated user's own client
    (no longer attached to an arbitrary 'first' client)."""
    client_id = current_user.client_id
    if client_id is None:
        raise HTTPException(
            status_code=400,
            detail="Aucun client associé à votre compte. Utilisez "
                   "POST /api/admin/clients/{client_id}/brand-systems pour cibler un client précis.",
        )
    bs = BrandSystem(client_id=client_id, **payload.model_dump())
    db.add(bs); db.commit(); db.refresh(bs)
    return {"id": bs.id, "brand_name": bs.brand_name, "version": bs.version}


@router.get("/brand-systems")
def list_brand_systems(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    q = db.query(BrandSystem).filter(BrandSystem.is_active == True)
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
def get_brand_system(
    bs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    # Tenant isolation: non-admins may only read brand systems of their own client.
    if current_user.role != ROLE_ADMIN and bs.client_id != current_user.client_id:
        raise HTTPException(status_code=404, detail="Brand system not found")
    # Never expose internal traceability fields publicly.
    _SENSITIVE = {"raw_extraction_json", "created_by"}
    return {c.name: getattr(bs, c.name) for c in bs.__table__.columns if c.name not in _SENSITIVE}


@router.put("/brand-systems/{bs_id}")
def update_brand_system(
    bs_id: int,
    payload: BrandSystemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: update brand system (append-only versioning)."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    
    # 1. Deactivate old version
    bs.is_active = False
    
    # 2. Create new version
    payload_dict = payload.model_dump(exclude_unset=True)
    new_version = bs.version + 1
    
    # Keep traceability if not explicitly overridden
    source_file = payload_dict.pop("source_file", bs.source_file)
    raw_json = payload_dict.pop("raw_extraction_json", bs.raw_extraction_json)
    
    new_bs = BrandSystem(
        client_id=bs.client_id,
        version=new_version,
        source_file=source_file,
        raw_extraction_json=raw_json,
        **{c.name: getattr(bs, c.name) for c in BrandSystem.__table__.columns if c.name not in ["id", "client_id", "version", "source_file", "raw_extraction_json", "is_active", "created_at", "created_by"] and c.name not in payload_dict},
        **payload_dict
    )
    db.add(new_bs)
    db.commit()
    db.refresh(new_bs)
    
    return {"id": new_bs.id, "version": new_bs.version}
