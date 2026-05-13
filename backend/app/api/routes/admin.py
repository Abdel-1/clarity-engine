"""Admin-only API routes. Require role=admin in JWT."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from sqlalchemy import func
from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_admin, require_brand_admin
from app.core.security import hash_password
from app.db.models.user import User, ROLE_CLIENT, ROLE_BRAND_ADMIN
from app.db.models.client import Client
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem
from app.core.security import decode_token, hash_password
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
bearer = HTTPBearer()


def require_admin(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    payload = decode_token(creds.credentials)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


# ── Pydantic schemas ──────────────────────────────────────────────────────

class ClientCreate(BaseModel):
    company_name: str
    sector: Optional[str] = None
    admin_email: str
    admin_password: str
    full_name: Optional[str] = None

class ClientUpdate(BaseModel):
    company_name: Optional[str] = None
    sector: Optional[str] = None

class PasswordReset(BaseModel):
    new_password: str

class BrandSystemCreate(BaseModel):
    brand_name: str
    brand_role: str
    master_statement: str
    priorities: str
    territories: str
    tone: str
    red_lines: str
    words_preferred: Optional[str] = None
    words_avoid: Optional[str] = None
    audiences: Optional[str] = None
    sector: Optional[str] = None

class BrandSystemUpdate(BaseModel):
    brand_name: Optional[str] = None
    brand_role: Optional[str] = None
    master_statement: Optional[str] = None
    priorities: Optional[str] = None
    territories: Optional[str] = None
    tone: Optional[str] = None
    red_lines: Optional[str] = None
    words_preferred: Optional[str] = None
    words_avoid: Optional[str] = None
    audiences: Optional[str] = None
    sector: Optional[str] = None


# ── Client CRUD ───────────────────────────────────────────────────────────

@router.post("/admin/clients", status_code=201)
def create_client(payload: ClientCreate, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Create a new client org + user account."""
    existing = db.query(User).filter(User.email == payload.admin_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    client = Client(company_name=payload.company_name, sector=payload.sector)
    db.add(client); db.commit(); db.refresh(client)
    user = User(
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.full_name or payload.company_name,
        role="client",
        client_id=client.id,
    )
    db.add(user); db.commit(); db.refresh(user)
    return {"client_id": client.id, "company_name": client.company_name, "user_id": user.id, "email": user.email}


@router.get("/admin/clients")
def list_clients(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """List all clients with usage stats."""
    clients = db.query(Client).all()
    result = []
    for c in clients:
        analyses = db.query(Analysis).filter(Analysis.client_id == c.id)\
                     .order_by(Analysis.analyzed_at.desc()).all()
        scores = [a.clarity_score for a in analyses]
        users = db.query(User).filter(User.client_id == c.id).all()
        brand_systems = db.query(BrandSystem).filter(BrandSystem.client_id == c.id).all()
        result.append({
            "id": c.id,
            "company_name": c.company_name,
            "sector": c.sector,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "total_analyses": len(analyses),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "last_score": analyses[0].clarity_score if analyses else None,
            "user_count": len(users),
            "brand_system_count": len(brand_systems),
            "users": [{"id": u.id, "email": u.email, "full_name": u.full_name} for u in users],
        })
    return result


@router.get("/admin/clients/{client_id}")
def get_client(client_id: int, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Full client detail: info + users + brand systems + recent analyses."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    users = db.query(User).filter(User.client_id == client_id).all()
    brand_systems = db.query(BrandSystem).filter(BrandSystem.client_id == client_id).all()
    analyses = db.query(Analysis).filter(Analysis.client_id == client_id)\
                 .order_by(Analysis.analyzed_at.desc()).limit(10).all()
    scores_all = [a.clarity_score for a in db.query(Analysis).filter(Analysis.client_id == client_id).all()]

    return {
        "id": client.id,
        "company_name": client.company_name,
        "sector": client.sector,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "total_analyses": len(scores_all),
        "avg_score": round(sum(scores_all) / len(scores_all), 1) if scores_all else 0,
        "users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "created_at": u.created_at.isoformat() if u.created_at else None} for u in users],
        "brand_systems": [_bs_serialize(bs) for bs in brand_systems],
        "recent_analyses": [_serialize(a, db) for a in analyses],
    }


@router.put("/admin/clients/{client_id}")
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Update client company name / sector."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if payload.company_name is not None:
        client.company_name = payload.company_name
    if payload.sector is not None:
        client.sector = payload.sector
    db.commit(); db.refresh(client)
    return {"id": client.id, "company_name": client.company_name, "sector": client.sector}


@router.post("/admin/clients/{client_id}/users/{user_id}/reset-password")
def reset_user_password(client_id: int, user_id: int, payload: PasswordReset,
                        db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Reset a client user's password."""
    user = db.query(User).filter(User.id == user_id, User.client_id == client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ── Brand System management per client ───────────────────────────────────

@router.post("/admin/clients/{client_id}/brand-systems", status_code=201)
def create_client_brand_system(client_id: int, payload: BrandSystemCreate,
                               db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Create a brand system assigned to a specific client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    bs = BrandSystem(
        client_id=client_id,
        brand_name=payload.brand_name,
        brand_role=payload.brand_role,
        master_statement=payload.master_statement,
        priorities=payload.priorities,
        territories=payload.territories,
        tone=payload.tone,
        red_lines=payload.red_lines,
        words_preferred=payload.words_preferred,
        words_avoid=payload.words_avoid,
        audiences=payload.audiences,
        sector=payload.sector,
    )
    db.add(bs); db.commit(); db.refresh(bs)
    return _bs_serialize(bs)


@router.put("/admin/brand-systems/{bs_id}")
def update_brand_system(bs_id: int, payload: BrandSystemUpdate,
                        db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Update any field of a brand system."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    for field, val in payload.dict(exclude_none=True).items():
        setattr(bs, field, val)
    db.commit(); db.refresh(bs)
    return _bs_serialize(bs)


@router.delete("/admin/brand-systems/{bs_id}", status_code=204)
def delete_brand_system(bs_id: int, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Deactivate a brand system (soft delete)."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    bs.is_active = False
    db.commit()


@router.get("/admin/clients/{client_id}/stats")
def client_stats(client_id: int, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    analyses = db.query(Analysis).filter(Analysis.client_id == client_id)\
                 .order_by(Analysis.analyzed_at.desc()).all()
    scores = [a.clarity_score for a in analyses]
    rewrites = [a for a in analyses if a.parent_analysis_id]
    before_scores, after_scores = [], []
    for a in rewrites:
        parent = db.query(Analysis).filter(Analysis.id == a.parent_analysis_id).first()
        if parent:
            before_scores.append(parent.clarity_score)
            after_scores.append(a.clarity_score)
    top = [a for a in analyses if a.clarity_score >= 95]
    return {
        "client_id": client_id,
        "company_name": client.company_name,
        "total_analyses": len(analyses),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "last_score": analyses[0].clarity_score if analyses else None,
        "avg_before_rewrite": round(sum(before_scores) / len(before_scores), 1) if before_scores else None,
        "avg_after_rewrite": round(sum(after_scores) / len(after_scores), 1) if after_scores else None,
        "top_scorers": [{"title": a.message_title, "score": a.clarity_score, "date": a.analyzed_at.isoformat()} for a in top[:5]],
    }


@router.get("/admin/clients/{client_id}/analyses")
def client_analyses(client_id: int, db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    rows = db.query(Analysis).filter(Analysis.client_id == client_id)\
             .order_by(Analysis.analyzed_at.desc()).limit(50).all()
    return [_serialize(r, db) for r in rows]


@router.get("/admin/stats")
def global_stats(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    analyses = db.query(Analysis).all()
    clients = db.query(Client).all()
    scores = [a.clarity_score for a in analyses]
    rewrites = [a for a in analyses if a.parent_analysis_id]
    before, after = [], []
    for a in rewrites:
        p = db.query(Analysis).filter(Analysis.id == a.parent_analysis_id).first()
        if p:
            before.append(p.clarity_score); after.append(a.clarity_score)
    top = sorted([a for a in analyses if a.clarity_score >= 95], key=lambda x: x.analyzed_at, reverse=True)
    return {
        "total_clients": len(clients),
        "total_analyses": len(analyses),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "last_score": analyses[-1].clarity_score if analyses else None,
        "best_improvement": max((a - b for b, a in zip(before, after)), default=None),
        "avg_before_rewrite": round(sum(before) / len(before), 1) if before else None,
        "avg_after_rewrite": round(sum(after) / len(after), 1) if after else None,
        "top_scorers": [{"title": a.message_title, "score": a.clarity_score, "date": a.analyzed_at.isoformat()} for a in top[:3]],
    }


# ── Helpers ───────────────────────────────────────────────────────────────

def _bs_serialize(bs: BrandSystem) -> dict:
    return {
        "id": bs.id, "brand_name": bs.brand_name, "sector": bs.sector,
        "brand_role": bs.brand_role, "master_statement": bs.master_statement,
        "priorities": bs.priorities, "territories": bs.territories,
        "tone": bs.tone, "red_lines": bs.red_lines,
        "words_preferred": bs.words_preferred, "words_avoid": bs.words_avoid,
        "audiences": bs.audiences, "is_active": bs.is_active,
        "created_at": bs.created_at.isoformat() if bs.created_at else None,
        "client_id": bs.client_id,
    }

def _serialize(row: Analysis, db: Session) -> dict:
    bs = db.query(BrandSystem).filter(BrandSystem.id == row.brand_system_id).first()
    return {
        "id": row.id, "message_title": row.message_title,
        "brand_system_name": bs.brand_name if bs else "—",
        "clarity_score": row.clarity_score,
        "analyzed_at": row.analyzed_at.isoformat() if row.analyzed_at else None,
        "parent_analysis_id": row.parent_analysis_id,
    }


class ClientUserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

# ── Brand Admin: Provision brand_admin user ────────────────────────────────────

@router.post("/clients/{client_id}/brand-admins", status_code=201)
def create_brand_admin(
    client_id: int,
    payload: ClientUserCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Super-admin creates a brand_admin for a specific client.
    Brand admins can see their client's stats and add client users.
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
        role            = ROLE_BRAND_ADMIN,
        client_id       = client_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id":        user.id,
        "email":     user.email,
        "full_name": user.full_name,
        "role":      user.role,
        "client_id": user.client_id,
    }


# ── Brand Admin: Scoped endpoints (brand_admin role required) ──────────────────

brand_router = APIRouter(prefix="/brand", tags=["brand"])


@brand_router.get("/stats")
def brand_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """Aggregated stats for the brand admin's own client."""
    cid   = current_user.client_id
    total = db.query(func.count(Analysis.id)).filter(Analysis.client_id == cid).scalar() or 0
    avg   = db.query(func.avg(Analysis.clarity_score)).filter(Analysis.client_id == cid).scalar()
    bs_ct = db.query(func.count(BrandSystem.id)).filter(BrandSystem.client_id == cid).scalar() or 0
    u_ct  = db.query(func.count(User.id)).filter(User.client_id == cid, User.role == ROLE_CLIENT).scalar() or 0

    risk_rows = (
        db.query(Analysis.narrative_risk, func.count(Analysis.id))
        .filter(Analysis.client_id == cid)
        .group_by(Analysis.narrative_risk)
        .all()
    )
    risk_dist = {r: c for r, c in risk_rows}

    client = db.query(Client).filter(Client.id == cid).first()
    return {
        "company_name":      client.company_name if client else "",
        "total_analyses":    total,
        "avg_score":         round(float(avg), 1) if avg else None,
        "brand_system_count": bs_ct,
        "user_count":        u_ct,
        "risk_distribution": risk_dist,
    }


@brand_router.get("/analyses")
def brand_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """All analyses scoped to the brand admin's client, with the team member who ran each one."""
    rows = (
        db.query(Analysis)
        .filter(Analysis.client_id == current_user.client_id)
        .order_by(Analysis.analyzed_at.desc())
        .all()
    )
    result = []
    for r in rows:
        bs = db.query(BrandSystem).filter(BrandSystem.id == r.brand_system_id).first()
        # Resolve analyzed_by email → full name if we have a matching user
        member_name = None
        if r.analyzed_by:
            u = db.query(User).filter(User.email == r.analyzed_by, User.client_id == current_user.client_id).first()
            member_name = u.full_name if u and u.full_name else r.analyzed_by
        result.append({
            "id":               r.id,
            "brand_system_id":  r.brand_system_id,
            "brand_system_name": bs.brand_name if bs else "—",
            "message_title":    r.message_title,
            "clarity_score":    r.clarity_score,
            "narrative_risk":   r.narrative_risk,
            "channel":          r.channel,
            "analyzed_at":      r.analyzed_at.isoformat() if r.analyzed_at else None,
            "analyzed_by":      r.analyzed_by,
            "member_name":      member_name or r.analyzed_by or "—",
        })
    return result


@brand_router.get("/members")
def brand_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """List distinct team members (client users) who have run at least one analysis."""
    # All client users in this org
    users = (
        db.query(User)
        .filter(User.client_id == current_user.client_id, User.role == ROLE_CLIENT)
        .all()
    )
    result = []
    for u in users:
        count = db.query(func.count(Analysis.id)).filter(
            Analysis.client_id == current_user.client_id,
            Analysis.analyzed_by == u.email,
        ).scalar() or 0
        result.append({
            "email":      u.email,
            "full_name":  u.full_name or u.email,
            "analysis_count": count,
        })
    return result



class BrandUserCreate(BaseModel):
    email:     str
    password:  str
    full_name: Optional[str] = None


@brand_router.post("/users", status_code=201)
def brand_create_user(
    payload: BrandUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """Brand admin creates a client (engine) user in their own organisation."""
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email           = payload.email,
        hashed_password = hash_password(payload.password),
        full_name       = payload.full_name,
        role            = ROLE_CLIENT,
        client_id       = current_user.client_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "id":        user.id,
        "email":     user.email,
        "full_name": user.full_name,
        "role":      user.role,
        "client_id": user.client_id,
    }


@brand_router.get("/users")
def brand_list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """List all users (client role) in the brand admin's organisation."""
    users = (
        db.query(User)
        .filter(User.client_id == current_user.client_id, User.role == ROLE_CLIENT)
        .order_by(User.id)
        .all()
    )
    return [
        {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role}
        for u in users
    ]
