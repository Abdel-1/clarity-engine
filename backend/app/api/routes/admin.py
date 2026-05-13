"""
Admin-only routes — all endpoints require role="admin".

Capabilities
------------
POST /api/admin/clients                      → Create a new Client account
POST /api/admin/clients/{id}/brand-system    → Provision brand system for client (admin flow)
POST /api/admin/clients/{id}/users           → Provision a login for that client
GET  /api/admin/clients                      → List all clients
GET  /api/admin/clients/{id}                 → Single client + brand systems
GET  /api/admin/analyses                     → All analyses across every client
GET  /api/admin/stats                        → Aggregated global analytics
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, ValidationInfo
from typing import Optional, List

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_admin
from app.core.security import hash_password
from app.db.models.user import User, ROLE_CLIENT
from app.db.models.client import Client
from app.db.models.brand_system import BrandSystem
from app.db.models.analyses import Analysis

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    company_name: str
    sector: Optional[str] = None


class ClientUserCreate(BaseModel):
    email:     str
    password:  str
    full_name: Optional[str] = None


class BrandSystemProvision(BaseModel):
    brand_name:       str
    brand_role:       str
    master_statement: str
    priorities:       str
    territories:      str
    tone:             str
    red_lines:        str
    words_preferred:  Optional[str] = ""
    words_avoid:      Optional[str] = ""
    audiences:        Optional[str] = ""
    sector:           Optional[str] = ""

    @field_validator("brand_name", "brand_role", "master_statement",
                    "priorities", "territories", "tone", "red_lines",
                    mode="before")
    @classmethod
    def must_not_be_empty(cls, v: str, info: ValidationInfo):
        if not v or not str(v).strip():
            raise ValueError(f"{info.field_name} is required and cannot be empty")
        return v.strip()


# ── Client management ──────────────────────────────────────────────────────────

@router.post("/clients", status_code=201)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Create a new client organisation."""
    existing = db.query(Client).filter(Client.company_name == payload.company_name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A client with that name already exists")

    client = Client(**payload.dict())
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"id": client.id, "company_name": client.company_name, "sector": client.sector}


@router.post("/clients/{client_id}/brand-system", status_code=201)
def provision_brand_system(
    client_id: int,
    payload: BrandSystemProvision,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Create a brand system scoped to a client — called by admin during onboarding."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    bs = BrandSystem(client_id=client_id, **payload.dict())
    db.add(bs)
    db.commit()
    db.refresh(bs)
    return {"id": bs.id, "brand_name": bs.brand_name, "version": bs.version}


@router.post("/clients/{client_id}/users", status_code=201)
def provision_client_user(
    client_id: int,
    payload: ClientUserCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Create a login credential for an existing client.
    The user is automatically scoped to that client_id.
    """
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email           = payload.email,
        hashed_password = hash_password(payload.password),
        full_name       = payload.full_name,
        role            = ROLE_CLIENT,
        client_id       = client_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id":         user.id,
        "email":      user.email,
        "full_name":  user.full_name,
        "role":       user.role,
        "client_id":  user.client_id,
    }


@router.get("/clients")
def list_clients(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Return all clients with a summary of their brand systems."""
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
    result = []
    for c in clients:
        brand_systems = db.query(BrandSystem).filter(
            BrandSystem.client_id == c.id,
            BrandSystem.is_active == True,
        ).all()
        users = db.query(User).filter(User.client_id == c.id).all()
        result.append({
            "id":           c.id,
            "company_name": c.company_name,
            "sector":       c.sector,
            "created_at":   c.created_at.isoformat() if c.created_at else None,
            "brand_systems": [
                {"id": bs.id, "brand_name": bs.brand_name, "version": bs.version}
                for bs in brand_systems
            ],
            "user_count": len(users),
        })
    return result


@router.get("/clients/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Single client with full brand system list and user roster."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    brand_systems = db.query(BrandSystem).filter(BrandSystem.client_id == client_id).all()
    users = db.query(User).filter(User.client_id == client_id).all()

    return {
        "id":           client.id,
        "company_name": client.company_name,
        "sector":       client.sector,
        "created_at":   client.created_at.isoformat() if client.created_at else None,
        "brand_systems": [
            {c.name: getattr(bs, c.name) for c in bs.__table__.columns}
            for bs in brand_systems
        ],
        "users": [
            {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}
            for u in users
        ],
    }


@router.put("/clients/{client_id}")
def update_client(
    client_id: int,
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Update client organisation info."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.company_name = payload.company_name
    client.sector = payload.sector
    db.commit()
    db.refresh(client)
    return {"id": client.id, "company_name": client.company_name}


@router.delete("/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Delete a client and ALL associated data (Users, BrandSystems, Analyses)."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Cascade deletes are usually handled by DB, but we'll be explicit if needed or rely on relationship(..., cascade="all, delete-orphan")
    # For this project, let's assume we want to wipe it all.
    db.delete(client)
    db.commit()
    return {"detail": "Client and all associated data deleted"}


@router.put("/clients/{client_id}/brand-systems/{bs_id}")
def update_client_brand_system(
    client_id: int,
    bs_id: int,
    payload: BrandSystemProvision,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Update a specific brand system for a client."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id, BrandSystem.client_id == client_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(bs, k, v)
    bs.version += 1
    db.commit()
    db.refresh(bs)
    return {"id": bs.id, "version": bs.version}


@router.delete("/clients/{client_id}/brand-systems/{bs_id}")
def delete_client_brand_system(
    client_id: int,
    bs_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Delete a specific brand system."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id, BrandSystem.client_id == client_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")

    db.delete(bs)
    db.commit()
    return {"detail": "Brand system deleted"}


# ── Global analysis visibility ─────────────────────────────────────────────────

@router.get("/analyses")
def list_all_analyses(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Return all analyses across every client — admin only."""
    rows = db.query(Analysis).order_by(Analysis.analyzed_at.desc()).all()
    return [
        {
            "id":              r.id,
            "client_id":       r.client_id,
            "brand_system_id": r.brand_system_id,
            "message_title":   r.message_title,
            "clarity_score":   r.clarity_score,
            "narrative_risk":  r.narrative_risk,
            "analyzed_at":     r.analyzed_at.isoformat() if r.analyzed_at else None,
        }
        for r in rows
    ]


@router.get("/stats")
def global_stats(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Aggregated analytics across ALL clients for the admin dashboard."""
    total        = db.query(func.count(Analysis.id)).scalar() or 0
    avg_score    = db.query(func.avg(Analysis.clarity_score)).scalar()
    client_count = db.query(func.count(Client.id)).scalar() or 0
    bs_count     = db.query(func.count(BrandSystem.id)).scalar() or 0

    risk_rows = (
        db.query(Analysis.narrative_risk, func.count(Analysis.id))
        .group_by(Analysis.narrative_risk)
        .all()
    )
    risk_dist = {r: c for r, c in risk_rows}

    # Per-client breakdown
    clients = db.query(Client).all()
    per_client = []
    for c in clients:
        ct = db.query(func.count(Analysis.id)).filter(Analysis.client_id == c.id).scalar() or 0
        avg = db.query(func.avg(Analysis.clarity_score)).filter(Analysis.client_id == c.id).scalar()
        per_client.append({
            "client_id":    c.id,
            "company_name": c.company_name,
            "total":        ct,
            "avg_score":    round(float(avg), 1) if avg else None,
        })

    return {
        "total_analyses":  total,
        "avg_score":       round(float(avg_score), 1) if avg_score else None,
        "client_count":    client_count,
        "brand_system_count": bs_count,
        "risk_distribution": risk_dist,
        "per_client":      per_client,
    }
