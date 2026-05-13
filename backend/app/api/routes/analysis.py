import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_client
from app.core.security import decode_token
from app.db.models.user import User, ROLE_ADMIN
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem
from app.services.brand_analysis_service import analyze_message, rewrite_message

router = APIRouter()
_optional_bearer = HTTPBearer(auto_error=False)


def _get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Decode token if present; return None if missing or invalid."""
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload or "user_id" not in payload:
        return None
    return db.query(User).filter(User.id == payload["user_id"]).first()


class AnalyzeRequest(BaseModel):
    brand_system_id:    int
    message_title:      str
    message_body:       str
    message_language:   Optional[str] = "fr"
    channel:            Optional[str] = None
    audience:           Optional[str] = None
    objective:          Optional[str] = None
    content_type:       Optional[str] = None
    author:             Optional[str] = None
    campaign:           Optional[str] = None
    parent_analysis_id: Optional[int] = None   # set when re-analyzing after rewrite


class RewriteRequest(BaseModel):
    brand_system_id:  int
    original_message: str
    instruction:      str
    points_faibles:   list[str] = []
    recommandations:  list[str] = []


@router.post("/analyze", status_code=201)
def run_analysis(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(_get_optional_user),
):
    bs = db.query(BrandSystem).filter(BrandSystem.id == payload.brand_system_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")

    metadata = payload.dict(exclude={"brand_system_id", "message_body", "parent_analysis_id"})

    try:
        result = analyze_message(bs, payload.message_body, metadata)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    sub = result["subscores"]
    row = Analysis(
        client_id=bs.client_id,
        brand_system_id=bs.id,
        parent_analysis_id=payload.parent_analysis_id,
        message_title=payload.message_title,
        message_body=payload.message_body,
        message_language=payload.message_language,
        channel=payload.channel,
        audience=payload.audience,
        objective=payload.objective,
        content_type=payload.content_type,
        author=payload.author,
        campaign=payload.campaign,
        analyzed_by=current_user.email if current_user else (payload.author or None),
        clarity_score=result["clarity_score"],
        sub_clarity=sub["clarity"],
        sub_alignment=sub["alignment"],
        sub_focus=sub["focus"],
        sub_tone=sub["tone"],
        sub_narrative_contribution=sub["narrative_contribution"],
        narrative_risk=result.get("narrative_risk", "Low"),
        points_forts=json.dumps(result["points_forts"]),
        points_faibles=json.dumps(result["points_faibles"]),
        recommandations=json.dumps(result["recommandations"]),
        raw_output=json.dumps(result),
    )
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "clarity_score": row.clarity_score, "narrative_risk": row.narrative_risk}


@router.post("/rewrite")
def run_rewrite(payload: RewriteRequest, db: Session = Depends(get_db)):
    bs = db.query(BrandSystem).filter(BrandSystem.id == payload.brand_system_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Brand system not found")
    try:
        result = rewrite_message(
            bs, payload.original_message, payload.instruction,
            {"points_faibles": payload.points_faibles, "recommandations": payload.recommandations}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyses")
def list_analyses(
    risk: Optional[str]    = Query(None),
    channel: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Analysis)
    if risk:    q = q.filter(Analysis.narrative_risk == risk)
    if channel: q = q.filter(Analysis.channel == channel)
    if date_from:
        q = q.filter(Analysis.analyzed_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.filter(Analysis.analyzed_at <= datetime.fromisoformat(date_to))
    rows = q.order_by(Analysis.analyzed_at.desc()).all()
    return [_serialize(r, db) for r in rows]


@router.get("/analyses/stats")
def get_stats(db: Session = Depends(get_db)):
    rows = db.query(Analysis).order_by(Analysis.analyzed_at.desc()).all()
    if not rows:
        return {
            "total": 0, "avg_score": 0, "last_score": None,
            "best_improvement": None, "avg_before_rewrite": None, "avg_after_rewrite": None,
            "top_scorers": [], "risk_distribution": {"Low": 0, "Medium": 0, "High": 0},
        }

    scores = [r.clarity_score for r in rows]
    avg = sum(scores) / len(scores)
    last_score = rows[0].clarity_score if rows else None

    # Before / After rewrite tracking
    rewrites = [r for r in rows if r.parent_analysis_id]
    before_scores, after_scores, improvements = [], [], []
    for r in rewrites:
        parent = db.query(Analysis).filter(Analysis.id == r.parent_analysis_id).first()
        if parent:
            before_scores.append(parent.clarity_score)
            after_scores.append(r.clarity_score)
            improvements.append(r.clarity_score - parent.clarity_score)

    best_improvement = max(improvements) if improvements else None
    avg_before = round(sum(before_scores) / len(before_scores), 1) if before_scores else None
    avg_after  = round(sum(after_scores)  / len(after_scores),  1) if after_scores  else None

    # Content that reached 95%+
    top_scorers = [
        {"title": r.message_title, "score": r.clarity_score,
         "date": r.analyzed_at.isoformat() if r.analyzed_at else None, "id": r.id}
        for r in rows if r.clarity_score >= 95
    ][:5]

    dist = {"Low": 0, "Medium": 0, "High": 0}
    for r in rows:
        if r.narrative_risk:
            dist[r.narrative_risk] = dist.get(r.narrative_risk, 0) + 1

    return {
        "total": len(rows),
        "avg_score": round(avg, 1),
        "last_score": last_score,
        "best_improvement": best_improvement,
        "avg_before_rewrite": avg_before,
        "avg_after_rewrite": avg_after,
        "top_scorers": top_scorers,
        "risk_distribution": dist,
    }


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    row = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    data = _serialize(row, db)
    data["points_forts"]    = json.loads(row.points_forts)
    data["points_faibles"]  = json.loads(row.points_faibles)
    data["recommandations"] = json.loads(row.recommandations)
    return data


def _serialize(row: Analysis, db: Session) -> dict:
    bs = db.query(BrandSystem).filter(BrandSystem.id == row.brand_system_id).first()
    return {
        "id": row.id,
        "brand_system_id":   row.brand_system_id,
        "brand_system_name": bs.brand_name if bs else "—",
        "message_title":     row.message_title,
        "message_body":      row.message_body,
        "message_language":  row.message_language,
        "channel":           row.channel,
        "content_type":      row.content_type,
        "clarity_score":     row.clarity_score,
        "sub_clarity":       row.sub_clarity,
        "sub_alignment":     row.sub_alignment,
        "sub_focus":         row.sub_focus,
        "sub_tone":          row.sub_tone,
        "sub_narrative_contribution": row.sub_narrative_contribution,
        "narrative_risk":    row.narrative_risk,
        "parent_analysis_id": row.parent_analysis_id,
        "analyzed_at":       row.analyzed_at.isoformat() if row.analyzed_at else None,
    }
