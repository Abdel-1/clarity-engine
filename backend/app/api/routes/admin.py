"""Admin-only API routes. Require role=admin in JWT."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from sqlalchemy import func, or_
from app.core.config import settings
from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_admin, require_brand_admin
from app.core.security import hash_password, password_policy_error
from app.core.identity import sync_author_identity
from app.db.models.user import User, ROLE_CLIENT, ROLE_BRAND_ADMIN
from app.db.models.client import Client
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem
from app.db.models.audit_log import AuditLog, record_audit

router = APIRouter()


def _require_strong_password(password: str) -> None:
    """Reject weak admin-chosen passwords (provisioning & resets)."""
    err = password_policy_error(password)
    if err:
        raise HTTPException(status_code=400, detail=err)


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
    brand_role: Optional[str] = ""
    master_statement: Optional[str] = ""
    priorities: Optional[str] = ""
    territories: Optional[str] = ""
    tone: Optional[str] = ""
    red_lines: Optional[str] = ""
    words_preferred: Optional[str] = ""
    words_avoid: Optional[str] = ""
    audiences: Optional[str] = ""
    sector: Optional[str] = ""

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

class AccessToggle(BaseModel):
    """Enable / disable analysis-engine access for a brand system or a member."""
    enabled: bool


# ── Client CRUD ───────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    """Lightweight payload — creates the organisation only (no user)."""
    company_name: str
    sector: Optional[str] = None

@router.post("/admin/clients/org", status_code=201)
def create_org_only(
    payload: OrgCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    """Step-1 of client provisioning: create only the Client organisation record.
    Returns { id, company_name, sector } — the id is used by subsequent steps.
    """
    client = Client(company_name=payload.company_name, sector=payload.sector)
    db.add(client)
    db.flush()
    record_audit(db, actor=actor, action="client.create", target_type="client",
                 target_id=client.id, client_id=client.id,
                 detail={"company_name": client.company_name})
    db.commit()
    db.refresh(client)
    return {
        "id": client.id,
        "company_name": client.company_name,
        "sector": client.sector,
        "created_at": client.created_at.isoformat() if client.created_at else None,
    }


@router.post("/admin/clients", status_code=201)
def create_client(payload: ClientCreate, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Create a new client org + user account in a single call (legacy / API use)."""
    existing = db.query(User).filter(User.email == payload.admin_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    _require_strong_password(payload.admin_password)
    client = Client(company_name=payload.company_name, sector=payload.sector)
    db.add(client); db.commit(); db.refresh(client)
    user = User(
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.full_name or payload.company_name,
        role=ROLE_CLIENT,
        client_id=client.id,
    )
    db.add(user); db.flush()
    record_audit(db, actor=actor, action="client.create", target_type="client",
                 target_id=client.id, client_id=client.id,
                 detail={"company_name": client.company_name, "first_user": user.email})
    db.commit(); db.refresh(user)
    return {"id": client.id, "client_id": client.id, "company_name": client.company_name, "user_id": user.id, "email": user.email}


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
            "brand_systems": [{"id": bs.id, "brand_name": bs.brand_name, "version": bs.version} for bs in brand_systems],
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
        "users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "analysis_enabled": bool(getattr(u, "analysis_enabled", True)), "created_at": u.created_at.isoformat() if u.created_at else None} for u in users],
        "brand_systems": [_bs_serialize(bs, db) for bs in brand_systems],
        "recent_analyses": [_serialize(a, db) for a in analyses],
    }


@router.put("/admin/clients/{client_id}")
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Update client company name / sector."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if payload.company_name is not None:
        client.company_name = payload.company_name
    if payload.sector is not None:
        client.sector = payload.sector
    record_audit(db, actor=actor, action="client.update", target_type="client",
                 target_id=client_id, client_id=client_id,
                 detail=payload.model_dump(exclude_none=True))
    db.commit(); db.refresh(client)
    return {"id": client.id, "company_name": client.company_name, "sector": client.sector}


@router.delete("/admin/clients/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Delete a client and all associated data."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    # 1. All analyses linked to this client
    db.query(Analysis).filter(Analysis.client_id == client_id).delete(synchronize_session=False)

    # 3. All brand systems of the client
    db.query(BrandSystem).filter(BrandSystem.client_id == client_id).delete(synchronize_session=False)

    # 4. All users belonging to the client
    db.query(User).filter(User.client_id == client_id).delete(synchronize_session=False)

    # 5. The client itself
    record_audit(db, actor=actor, action="client.delete", target_type="client",
                 target_id=client_id, client_id=client_id,
                 detail={"company_name": client.company_name})
    db.delete(client)
    db.commit()
    return None


@router.post("/admin/clients/{client_id}/users/{user_id}/reset-password")
def reset_user_password(client_id: int, user_id: int, payload: PasswordReset,
                        db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Reset a client user's password."""
    user = db.query(User).filter(User.id == user_id, User.client_id == client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _require_strong_password(payload.new_password)
    user.hashed_password = hash_password(payload.new_password)
    # Revoke the target user's existing sessions (their old token must stop working).
    # Whole-second truncation so a token minted in the same second isn't rejected.
    user.tokens_valid_after = datetime.utcnow().replace(microsecond=0)
    record_audit(db, actor=actor, action="user.password_reset", target_type="user",
                 target_id=user_id, client_id=client_id, detail={"email": user.email})
    db.commit()
    return {"message": "Password updated successfully"}


# ── Brand System management per client ───────────────────────────────────

@router.post("/admin/clients/{client_id}/brand-systems", status_code=201)
def create_client_brand_system(client_id: int, payload: BrandSystemCreate,
                               db: Session = Depends(get_db), actor: User = Depends(require_admin)):
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
    db.add(bs); db.flush()
    record_audit(db, actor=actor, action="brand_system.create", target_type="brand_system",
                 target_id=bs.id, client_id=client_id, detail={"brand_name": bs.brand_name})
    db.commit(); db.refresh(bs)
    return _bs_serialize(bs, db)


@router.put("/admin/clients/{client_id}/brand-systems/{bs_id}")
def update_brand_system(client_id: int, bs_id: int, payload: BrandSystemUpdate,
                        db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Update any field of a brand system."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id, BrandSystem.client_id == client_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found for this client")
    changed = payload.model_dump(exclude_none=True)
    for field, val in changed.items():
        setattr(bs, field, val)
    record_audit(db, actor=actor, action="brand_system.update", target_type="brand_system",
                 target_id=bs_id, client_id=client_id,
                 detail={"fields": sorted(changed.keys()), "brand_name": bs.brand_name})
    db.commit(); db.refresh(bs)
    return _bs_serialize(bs, db)


@router.delete("/admin/clients/{client_id}/brand-systems/{bs_id}")
def delete_brand_system(client_id: int, bs_id: int, db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Hard-delete a brand system and everything under it: every version of the
    brand and all analyses produced against it. When it was the client's last
    brand system, the client's users and the client record are removed too, so
    nothing is left orphaned anywhere on the platform.
    Returns whether the whole client was purged (so the UI can redirect)."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id, BrandSystem.client_id == client_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found for this client")

    # Append-only versioning: gather every version row of this brand for the client.
    version_ids = [
        r.id for r in db.query(BrandSystem)
        .filter(BrandSystem.client_id == client_id, BrandSystem.brand_name == bs.brand_name)
        .all()
    ]

    # 1. All analyses produced against any version of this brand.
    db.query(Analysis).filter(Analysis.brand_system_id.in_(version_ids)).delete(synchronize_session=False)

    # 2. The brand system versions themselves.
    db.query(BrandSystem).filter(BrandSystem.id.in_(version_ids)).delete(synchronize_session=False)

    # 3. If this was the client's last brand system, purge the whole organisation
    #    (its remaining analyses, its users and the client record) so no user or
    #    data is left stranded without a brand.
    client_deleted = db.query(BrandSystem).filter(BrandSystem.client_id == client_id).count() == 0
    if client_deleted:
        db.query(Analysis).filter(Analysis.client_id == client_id).delete(synchronize_session=False)
        db.query(User).filter(User.client_id == client_id).delete(synchronize_session=False)
        db.query(Client).filter(Client.id == client_id).delete(synchronize_session=False)

    record_audit(db, actor=actor, action="brand_system.delete", target_type="brand_system",
                 target_id=bs_id, client_id=client_id,
                 detail={"brand_name": bs.brand_name, "versions_removed": len(version_ids),
                         "client_purged": client_deleted})
    db.commit()
    return {"deleted": True, "client_deleted": client_deleted}


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
    """List all analyses for a specific client."""
    rows = db.query(Analysis).filter(Analysis.client_id == client_id).order_by(Analysis.analyzed_at.desc()).all()
    return [_serialize(r, db) for r in rows]


@router.get("/admin/analyses")
def list_all_analyses(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """List all analyses across the whole platform (Admin only)."""
    rows = db.query(Analysis).order_by(Analysis.analyzed_at.desc()).all()
    # Ensure client_id and brand_system_id are in the output for the admin view
    res = []
    for r in rows:
        d = _serialize(r, db)
        d["client_id"] = r.client_id
        d["brand_system_id"] = r.brand_system_id
        d["narrative_risk"] = r.narrative_risk
        res.append(d)
    return res


@router.get("/admin/stats")
def global_stats(db: Session = Depends(get_db), _: dict = Depends(require_admin)):
    """Global platform-wide statistics for the admin dashboard."""
    analyses = db.query(Analysis).all()
    clients = db.query(Client).all()
    brand_systems = db.query(BrandSystem).all()
    
    scores = [a.clarity_score for a in analyses]
    risk_dist = {"Low": 0, "Medium": 0, "High": 0}
    for a in analyses:
        if a.narrative_risk:
            v = a.narrative_risk.lower().replace('é', 'e')
            if v in ("low", "faible"):
                risk_dist["Low"] += 1
            elif v in ("medium", "modere"):
                risk_dist["Medium"] += 1
            elif v in ("high", "eleve"):
                risk_dist["High"] += 1
            else:
                risk_dist[a.narrative_risk] = risk_dist.get(a.narrative_risk, 0) + 1
        
    per_client = []
    for c in clients:
        c_analyses = [a for a in analyses if a.client_id == c.id]
        c_scores = [a.clarity_score for a in c_analyses]
        per_client.append({
            "client_id": c.id,
            "company_name": c.company_name,
            "total": len(c_analyses),
            "avg_score": round(sum(c_scores) / len(c_scores), 1) if c_scores else None
        })

    total_cost = round(sum(
        (((a.prompt_tokens or 0) * settings.TOKEN_INPUT_PRICE_PER_1M)
         + ((a.completion_tokens or 0) * settings.TOKEN_OUTPUT_PRICE_PER_1M)) / 1_000_000
        for a in analyses
    ), 2)
    pct_high_risk = round(100 * risk_dist["High"] / len(analyses), 1) if analyses else 0

    return {
        "total_analyses": len(analyses),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "client_count": len(clients),
        "brand_system_count": len(brand_systems),
        "risk_distribution": risk_dist,
        # Decision KPIs for the admin landing page: platform spend and risk exposure.
        "total_cost": total_cost,
        "currency": settings.TOKEN_COST_CURRENCY,
        "pct_high_risk": pct_high_risk,
        "per_client": per_client,
    }


# ── Audit trail (super admin only) ─────────────────────────────────────────

@router.get("/admin/audit-log")
def list_audit_log(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Most-recent-first admin audit trail, paginated and filterable."""
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if client_id is not None:
        q = q.filter(AuditLog.client_id == client_id)
    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": r.id,
                "actor_email": r.actor_email,
                "actor_role": r.actor_role,
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "client_id": r.client_id,
                "detail": r.detail,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


# ── Helpers ───────────────────────────────────────────────────────────────

def _bs_serialize(bs: BrandSystem, db: Optional[Session] = None) -> dict:
    data = {
        "id": bs.id, "brand_name": bs.brand_name, "sector": bs.sector,
        "brand_role": bs.brand_role, "master_statement": bs.master_statement,
        "priorities": bs.priorities, "territories": bs.territories,
        "tone": bs.tone, "red_lines": bs.red_lines,
        "words_preferred": bs.words_preferred, "words_avoid": bs.words_avoid,
        "audiences": bs.audiences, "is_active": bs.is_active,
        "analysis_enabled": bool(getattr(bs, "analysis_enabled", True)),
        "version": bs.version,
        "created_at": bs.created_at.isoformat() if bs.created_at else None,
        "client_id": bs.client_id,
        # KPIs (decision support): how is this specific brand system performing,
        # and how risky is its output — both inform the suspend/resume toggle.
        "analyses_count": None, "avg_score": None, "pct_high_risk": None,
    }
    if db is not None:
        bs_analyses = db.query(Analysis).filter(Analysis.brand_system_id == bs.id).all()
        if bs_analyses:
            scores = [a.clarity_score for a in bs_analyses]
            high_risk = sum(1 for a in bs_analyses if (a.narrative_risk or "").strip().lower() in ("high", "élevé", "eleve"))
            data["analyses_count"] = len(bs_analyses)
            data["avg_score"] = round(sum(scores) / len(scores), 1)
            data["pct_high_risk"] = round(100 * high_risk / len(bs_analyses), 1)
    return data

def _serialize(row: Analysis, db: Session) -> dict:
    bs = db.query(BrandSystem).filter(BrandSystem.id == row.brand_system_id).first()
    return {
        "id": row.id, "message_title": row.message_title,
        "brand_system_name": bs.brand_name if bs else "—",
        "clarity_score": row.clarity_score,
        "analyzed_at": row.analyzed_at.isoformat() if row.analyzed_at else None,
        "parent_analysis_id": row.parent_analysis_id,
    }


# ── Admin: List all brand systems across all clients ───────────────────────────
@router.get("/admin/brand-systems")
def list_all_brand_systems(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Return all brand systems with client info, analysis count, and last date."""
    systems = db.query(BrandSystem).order_by(BrandSystem.id.desc()).all()
    result = []
    for bs in systems:
        client = db.query(Client).filter(Client.id == bs.client_id).first()
        analysis_count = db.query(func.count(Analysis.id)).filter(
            Analysis.brand_system_id == bs.id
        ).scalar() or 0
        last_analysis = db.query(func.max(Analysis.analyzed_at)).filter(
            Analysis.brand_system_id == bs.id
        ).scalar()
        result.append({
            "id":              bs.id,
            "brand_name":      bs.brand_name,
            "client_id":       bs.client_id,
            "company_name":    client.company_name if client else "—",
            "sector":          getattr(bs, "sector", None) or (client.sector if client else None),
            "analysis_count":  analysis_count,
            "last_analysis_at": last_analysis.isoformat() if last_analysis else None,
            "analysis_enabled": bool(getattr(bs, "analysis_enabled", True)),
        })
    return result


# ── Admin: suspend / resume analysis-engine access ─────────────────────────────
@router.patch("/admin/brand-systems/{bs_id}/access")
def set_brand_system_access(
    bs_id: int, payload: AccessToggle,
    db: Session = Depends(get_db), actor: User = Depends(require_admin),
):
    """Enable or disable the analysis engine for an entire brand system."""
    bs = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    bs.analysis_enabled = payload.enabled
    record_audit(db, actor=actor,
                 action="brand_system.access_enable" if payload.enabled else "brand_system.access_disable",
                 target_type="brand_system", target_id=bs_id, client_id=bs.client_id,
                 detail={"brand_name": bs.brand_name, "enabled": payload.enabled})
    db.commit(); db.refresh(bs)
    return {"id": bs.id, "brand_name": bs.brand_name,
            "analysis_enabled": bool(bs.analysis_enabled)}


@router.patch("/admin/users/{user_id}/access")
def set_user_access(
    user_id: int, payload: AccessToggle,
    db: Session = Depends(get_db), actor: User = Depends(require_admin),
):
    """Enable or disable the analysis engine for a single member."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.analysis_enabled = payload.enabled
    record_audit(db, actor=actor,
                 action="user.access_enable" if payload.enabled else "user.access_disable",
                 target_type="user", target_id=user_id, client_id=user.client_id,
                 detail={"email": user.email, "enabled": payload.enabled})
    db.commit(); db.refresh(user)
    return {"id": user.id, "email": user.email,
            "analysis_enabled": bool(user.analysis_enabled)}


class ClientUserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

# ── Brand Admin: Provision brand_admin user ────────────────────────────────────
@router.post("/admin/clients/{client_id}/brand-admins", status_code=201)
def create_brand_admin(
    client_id: int,
    payload: ClientUserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
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
    _require_strong_password(payload.password)

    user = User(
        email           = payload.email,
        hashed_password = hash_password(payload.password),
        full_name       = payload.full_name,
        role            = ROLE_BRAND_ADMIN,
        client_id       = client_id,
    )
    db.add(user)
    db.flush()  # assign user.id for the audit entry
    record_audit(db, actor=actor, action="user.create_brand_admin", target_type="user",
                 target_id=user.id, client_id=client_id, detail={"email": user.email})
    db.commit()
    db.refresh(user)
    return {
        "id":        user.id,
        "email":     user.email,
        "full_name": user.full_name,
        "role":      user.role,
        "client_id": user.client_id,
    }


@router.post("/admin/clients/{client_id}/users", status_code=201)
def create_client_user(client_id: int, payload: ClientUserCreate,
                       db: Session = Depends(get_db), actor: User = Depends(require_admin)):
    """Super-admin creates a regular client user."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    _require_strong_password(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=ROLE_CLIENT,
        client_id=client_id,
    )
    db.add(user); db.flush()
    record_audit(db, actor=actor, action="user.create", target_type="user",
                 target_id=user.id, client_id=client_id, detail={"email": user.email})
    db.commit(); db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role}


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

@router.put("/admin/users/{user_id}")
def update_user_admin(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_full_name, old_email, old_role = user.full_name, user.email, user.role
    changes: dict = {}

    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=409, detail="Email already registered")
        changes["email"] = {"from": old_email, "to": payload.email}
        user.email = payload.email

    if payload.full_name is not None and payload.full_name != old_full_name:
        changes["full_name"] = {"from": old_full_name, "to": payload.full_name}
        user.full_name = payload.full_name

    if payload.role and payload.role != old_role:
        changes["role"] = {"from": old_role, "to": payload.role}
        user.role = payload.role
        # A privilege change must invalidate the user's existing tokens (which carry
        # the old role) so they re-authenticate with the new role.
        user.tokens_valid_after = datetime.utcnow().replace(microsecond=0)

    # Propagate the new name/email to past analyses across the platform.
    sync_author_identity(
        db,
        old_full_name=old_full_name, old_email=old_email,
        new_full_name=user.full_name, new_email=user.email,
    )

    # Audit any privilege/identity change (role change is the security-critical one).
    if changes:
        action = "user.role_change" if "role" in changes else "user.update"
        record_audit(db, actor=actor, action=action, target_type="user",
                     target_id=user_id, client_id=user.client_id, detail=changes)

    db.commit()
    return {"message": "User updated"}

@router.delete("/admin/users/{user_id}")
def delete_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. All analyses authored by this user, by the stable authorship FK. Precise:
    #    it can't catch a same-name colleague's rows (which a name match would), and
    #    can't cross tenants. Legacy rows were backfilled to this FK in migrations.
    db.query(Analysis).filter(
        Analysis.analyzed_by_user_id == user.id
    ).delete(synchronize_session=False)

    record_audit(db, actor=actor, action="user.delete", target_type="user",
                 target_id=user_id, client_id=user.client_id,
                 detail={"email": user.email, "role": user.role})
    # 3. The user
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


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

    # Compute improvement deltas for rewrites within this client
    rewrites = db.query(Analysis).filter(
        Analysis.client_id == cid, Analysis.parent_analysis_id.isnot(None)
    ).all()
    improvements = []
    for r in rewrites:
        parent = db.query(Analysis).filter(Analysis.id == r.parent_analysis_id).first()
        if parent:
            improvements.append(r.clarity_score - parent.clarity_score)

    client = db.query(Client).filter(Client.id == cid).first()
    return {
        "company_name":       client.company_name if client else "",
        "total_analyses":     total,
        "avg_score":          round(float(avg), 1) if avg else None,
        "brand_system_count": bs_ct,
        "user_count":         u_ct,
        "risk_distribution":  risk_dist,
        "best_improvement":   max(improvements) if improvements else None,
        "weakest_improvement": min(improvements) if improvements else None,
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
        conds = [Analysis.analyzed_by == u.email]
        if u.full_name:
            conds.append(Analysis.analyzed_by == u.full_name)
            
        count = db.query(func.count(Analysis.id)).filter(
            Analysis.client_id == current_user.client_id,
            or_(*conds),
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
    _require_strong_password(payload.password)

    user = User(
        email           = payload.email,
        hashed_password = hash_password(payload.password),
        full_name       = payload.full_name,
        role            = ROLE_CLIENT,
        client_id       = current_user.client_id,
    )
    db.add(user)
    db.flush()
    record_audit(db, actor=current_user, action="user.create", target_type="user",
                 target_id=user.id, client_id=current_user.client_id, detail={"email": user.email})
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

@brand_router.put("/users/{user_id}")
def brand_update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """Brand admin updates a user in their own organisation."""
    user = db.query(User).filter(User.id == user_id, User.client_id == current_user.client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in your organisation")

    old_full_name, old_email = user.full_name, user.email

    # Only allow editing client users or themselves if they are the admin (but usually they manage others)
    if payload.email and payload.email != user.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=409, detail="Email already registered")
        user.email = payload.email

    if payload.full_name is not None:
        user.full_name = payload.full_name

    # Propagate the new name/email to past analyses across the platform.
    sync_author_identity(
        db,
        old_full_name=old_full_name, old_email=old_email,
        new_full_name=user.full_name, new_email=user.email,
    )

    db.commit()
    return {"message": "User updated"}

@brand_router.delete("/users/{user_id}")
def brand_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """Brand admin deletes a user in their own organisation."""
    user = db.query(User).filter(User.id == user_id, User.client_id == current_user.client_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in your organisation")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    # 1. All analyses authored by this user, by the stable authorship FK. Precise
    #    and tenant-safe (can't catch a same-name colleague or cross tenants).
    db.query(Analysis).filter(
        Analysis.analyzed_by_user_id == user.id
    ).delete(synchronize_session=False)

    record_audit(db, actor=current_user, action="user.delete", target_type="user",
                 target_id=user.id, client_id=current_user.client_id,
                 detail={"email": user.email})
    # 3. The user
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
