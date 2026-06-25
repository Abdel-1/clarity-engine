"""
analysis.py — API routes for Clarity Engine analysis
─────────────────────────────────────────────────────
POST /api/analyze : single-pass brand clarity analysis
GET  /api/analyses, /api/analyses/{id}, etc. : query & history
"""
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_client, get_current_user
from app.db.models.user import User, ROLE_ADMIN, ROLE_CLIENT
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem
from app.services.brand_analysis_service import (
    analyze, build_user_payload, _parse_and_validate, SYSTEM_PROMPT,
)
from app.prompts.clarity_system_prompt import PROMPT_VERSION
from app.lib.deepseek import stream_analyze
from app.core.risk import empty_risk_distribution, risk_distribution

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Auth helpers (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def _apply_user_scope(q, current_user: User):
    """
    Scope a query based on the user's role:
    - admin        → no extra filter (sees all)
    - brand_admin  → filtered by client_id only (sees full team)
    - client       → filtered by client_id AND analyzed_by (own analyses within
                     their own tenant). The client_id filter is the hard tenant
                     boundary; analyzed_by narrows to the member's own rows.
    """
    if current_user.role == ROLE_ADMIN:
        return q
    if current_user.role == ROLE_CLIENT:
        # Member self-scope keys off the stable authorship FK (analyzed_by_user_id),
        # NOT the spoofable analyzed_by display string. The client_id filter is kept
        # as a defensive tenant boundary. Legacy rows were backfilled to this FK in
        # db/migrations.py, so this is row-count-equivalent to the old name scope.
        return q.filter(
            Analysis.client_id == current_user.client_id,
            Analysis.analyzed_by_user_id == current_user.id,
        )
    # brand_admin (and any other non-admin role) → scoped to their client.
    return q.filter(Analysis.client_id == current_user.client_id)


def _load_brand_system_or_404(db: Session, bs_id: int, current_user: User) -> BrandSystem:
    """Load a Brand System enforcing tenant isolation.

    A non-admin may only load a brand system belonging to their own client.
    Returns the row, or raises 404 whether the row is missing OR belongs to
    another tenant (same status, so ids can't be enumerated). This is the guard
    that was missing on the analysis endpoints, which previously loaded any
    brand_system_id by id alone (cross-tenant IDOR).
    """
    bs_row = db.query(BrandSystem).filter(BrandSystem.id == bs_id).first()
    if not bs_row:
        raise HTTPException(status_code=404, detail="Brand system not found")
    if current_user.role != ROLE_ADMIN and bs_row.client_id != current_user.client_id:
        raise HTTPException(status_code=404, detail="Brand system not found")
    return bs_row


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    """Top-level request body for POST /api/analyze — simple flat format."""
    brand_system_id:    int
    message_body:       str
    message_title:      Optional[str] = None
    message_language:   Optional[str] = "fr"
    # All context fields are optional
    channel:            Optional[str] = None
    content_type:       Optional[str] = None
    audience:           Optional[str] = None
    objective:          Optional[str] = None
    campaign:           Optional[str] = None
    parent_analysis_id: Optional[int] = None
    conversation_id:    Optional[str] = None


def _bs_row_to_v1(bs: BrandSystem) -> dict:
    """Convert a BrandSystem DB row to the v1 schema dict the analysis service expects."""
    def parse_list(text: str) -> list:
        """Split bullet-list stored text back into a list of strings."""
        if not text:
            return []
        lines = [l.strip().lstrip("- •").strip() for l in text.splitlines() if l.strip()]
        return [l for l in lines if l]

    return {
        "nom_marque":             bs.brand_name or "",
        "role_marque":            bs.brand_role or "",
        "master_statement":       bs.master_statement or "",
        "priorites_strategiques": parse_list(bs.priorities or ""),
        "territoires_narratifs":  parse_list(bs.territories or ""),
        "ton_marque":             bs.tone or "",
        "lignes_rouges":          parse_list(bs.red_lines or ""),
        "mots_a_privilegier":     parse_list(bs.words_preferred or ""),
        "mots_a_eviter":          parse_list(bs.words_avoid or ""),
        "audiences_cles":         parse_list(bs.audiences or ""),
        "contexte_sectoriel":     bs.sector or "",
    }


def _resolve_tokens(usage: dict | None, prompt_text: str = "", completion_text: str = "") -> tuple[int, int, int]:
    """Return (prompt, completion, total) tokens.

    Prefer the provider's real usage; if absent (e.g. streaming without usage
    support), fall back to a ~chars/4 estimate so every analysis still has a figure.
    """
    if usage and usage.get("total_tokens"):
        return (
            int(usage.get("prompt_tokens") or 0),
            int(usage.get("completion_tokens") or 0),
            int(usage.get("total_tokens") or 0),
        )
    p = max(1, len(prompt_text) // 4)
    c = max(1, len(completion_text) // 4)
    return p, c, p + c


# ─────────────────────────────────────────────────────────────────────────────
# Analysis access control (admin can suspend the engine per brand / per member)
# ─────────────────────────────────────────────────────────────────────────────

def _check_analysis_access(current_user: User, bs_row: BrandSystem) -> None:
    """Raise 403 if the analysis engine is suspended for this member or this brand
    system. Admins are exempt (they own the switches). Member-level block wins:
    a suspended member is locked out of every brand."""
    if current_user and current_user.role == ROLE_ADMIN:
        return
    if current_user is not None and not getattr(current_user, "analysis_enabled", True):
        raise HTTPException(status_code=403, detail={
            "code": "analysis_disabled",
            "scope": "member",
            "brand_name": None,
            "message": "Votre accès à l'analyse a été suspendu par votre administrateur.",
        })
    if not getattr(bs_row, "analysis_enabled", True):
        raise HTTPException(status_code=403, detail={
            "code": "analysis_disabled",
            "scope": "brand",
            "brand_name": bs_row.brand_name,
            "message": f"L'analyse est suspendue pour le Brand System « {bs_row.brand_name} ».",
        })


# ─────────────────────────────────────────────────────────────────────────────
# Abuse / cost controls (B9): per-user burst limiter + per-tenant daily budget
# ─────────────────────────────────────────────────────────────────────────────

# In-memory, per-process sliding-window burst limiter. Best-effort (not shared
# across workers) — its only job is to absorb obvious per-second spam cheaply.
# The durable spend ceiling is the per-tenant daily token budget below.
_BURST_WINDOW_SECONDS = 60.0
_burst_lock = threading.Lock()
_burst_hits: dict[int, list[float]] = {}


def _check_burst_limit(user_id: int) -> None:
    limit = settings.ANALYZE_BURST_PER_MINUTE
    if not limit or limit <= 0:
        return
    now = time.monotonic()
    with _burst_lock:
        hits = [t for t in _burst_hits.get(user_id, []) if now - t < _BURST_WINDOW_SECONDS]
        if len(hits) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Trop de requêtes d'analyse. Patientez quelques instants avant de réessayer.",
            )
        hits.append(now)
        _burst_hits[user_id] = hits


def _check_tenant_budget(db: Session, client_id: Optional[int], current_user: User) -> None:
    """Reject the call if the tenant has exhausted its daily token budget.

    Durable and infra-free: it sums total_tokens already recorded on today's
    analyses for this client. Admins (no tenant) are exempt; 0 budget = unlimited.
    """
    if current_user.role == ROLE_ADMIN:
        return
    budget = settings.TENANT_DAILY_TOKEN_BUDGET
    if not budget or budget <= 0 or client_id is None:
        return
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = db.query(func.coalesce(func.sum(Analysis.total_tokens), 0)).filter(
        Analysis.client_id == client_id,
        Analysis.analyzed_at >= start_of_day,
    ).scalar() or 0
    if used >= budget:
        raise HTTPException(status_code=429, detail={
            "code": "tenant_budget_exceeded",
            "message": "Budget d'analyse quotidien atteint pour votre organisation. "
                       "Réessayez demain ou contactez votre administrateur.",
            "used_tokens": int(used),
            "budget_tokens": int(budget),
        })


@router.get("/analysis-access")
def analysis_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    """Whether the analysis engine is available for the current user, plus which
    of their brand systems are individually suspended. Lets the Analyze page show
    a lock up-front instead of waiting for a rejected submission."""
    is_admin = current_user.role == ROLE_ADMIN
    member_enabled = is_admin or bool(getattr(current_user, "analysis_enabled", True))

    q = db.query(BrandSystem).filter(BrandSystem.is_active == True)
    if not is_admin:
        q = q.filter(BrandSystem.client_id == current_user.client_id)
    brands = [
        {"id": r.id, "brand_name": r.brand_name,
         "enabled": is_admin or bool(getattr(r, "analysis_enabled", True))}
        for r in q.all()
    ]
    return {
        "member_enabled": member_enabled,
        "message": None if member_enabled
                   else "Votre accès à l'analyse a été suspendu par votre administrateur.",
        "brands": brands,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /analyze — single-pass brand clarity analysis
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze", status_code=201)
def run_analysis(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    """
    Single-pass analysis:
      1. Load BrandSystem from DB
      2. Build structured payload (brandSystem + metadata + message)
      3. Call DeepSeek once via analysis service
      4. Parse & validate JSON
      5. Persist to DB
      6. Return result
    """

    # ── Load Brand System ─────────────────────────────────────────────────
    bs_row = _load_brand_system_or_404(db, payload.brand_system_id, current_user)

    # ── Enforce analysis access (member / brand suspension) ───────────────
    _check_analysis_access(current_user, bs_row)

    # ── Abuse / cost controls (burst + per-tenant daily budget) ───────────
    _check_burst_limit(current_user.id)
    _check_tenant_budget(db, bs_row.client_id, current_user)

    # ── Build dicts for the service layer ─────────────────────────────────
    brand_system_dict = _bs_row_to_v1(bs_row)

    message_dict = {
        "titre":  payload.message_title or payload.message_body[:60],
        "langue": payload.message_language or "fr",
        "corps":  payload.message_body.strip(),
    }

    metadata_dict = {
        "audience":          payload.audience,
        "canal":             payload.channel,
        "objectif":          payload.objective,
        "type_prise_parole": payload.content_type,
        # date key intentionally omitted → build_user_payload defaults to today's date
        "auteur":            (
            (current_user.full_name or current_user.email)
            if current_user else None
        ),
    }

    # ── Call analysis service (single pass) ───────────────────────────────
    try:
        result = analyze(brand_system_dict, message_dict, metadata_dict)
    except Exception:
        # Log the real cause server-side; never echo internal/LLM error text to
        # the client (it can contain prompt fragments or stack detail).
        logger.exception("Analysis failed (brand_system_id=%s)", payload.brand_system_id)
        raise HTTPException(
            status_code=502,
            detail="L'analyse a échoué (service d'IA momentanément indisponible). Réessayez dans un instant.",
        )

    # API token consumption (popped so it isn't echoed in the scores payload).
    _ptok, _ctok, _ttok = _resolve_tokens(
        result.pop("token_usage", None),
        prompt_text=message_dict["corps"], completion_text=json.dumps(result, ensure_ascii=False),
    )

    # ── Conversation threading ────────────────────────────────────────────
    if payload.conversation_id:
        conv_id = payload.conversation_id
        existing_count = db.query(Analysis).filter(
            Analysis.conversation_id == conv_id
        ).count()
        iter_idx = existing_count
    else:
        conv_id  = str(uuid.uuid4())
        iter_idx = 0

    # ── Persist ───────────────────────────────────────────────────────────
    resolved_client_id = (
        bs_row.client_id
        or (current_user.client_id if current_user else None)
    )

    row = Analysis(
        client_id             = resolved_client_id,
        brand_system_id       = bs_row.id,
        parent_analysis_id    = payload.parent_analysis_id,
        conversation_id       = conv_id,
        iteration_index       = iter_idx,
        message_title         = message_dict["titre"],
        message_body          = message_dict["corps"],
        message_language      = message_dict.get("langue", "fr"),
        channel               = payload.channel,
        audience              = payload.audience,
        objective             = payload.objective,
        content_type          = payload.content_type,
        author                = metadata_dict.get("auteur"),
        campaign              = payload.campaign,
        analyzed_by           = (
            (current_user.full_name or current_user.email)
            if current_user else None
        ),
        analyzed_by_user_id   = current_user.id if current_user else None,
        clarity_score               = result.get("clarity_score", 0),
        sub_lisibilite              = result.get("sub_lisibilite", 0),
        sub_alignment               = result.get("sub_alignment", 0),
        sub_focus                   = result.get("sub_focus", 0),
        sub_tone                    = result.get("sub_tone", 0),
        sub_narrative_contribution  = result.get("sub_narrative_contribution", 0),
        narrative_risk              = result.get("narrative_risk", "Medium"),
        points_forts                = json.dumps(result.get("points_forts", []), ensure_ascii=False),
        points_faibles              = json.dumps(result.get("points_faibles", []), ensure_ascii=False),
        recommandations             = json.dumps(result.get("recommandations", []), ensure_ascii=False),
        raw_output                  = json.dumps(result, ensure_ascii=False),
        prompt_tokens               = _ptok,
        completion_tokens           = _ctok,
        total_tokens                = _ttok,
        prompt_version              = str(PROMPT_VERSION),
        brand_system_snapshot       = json.dumps(
            {"version": bs_row.version, "content": brand_system_dict}, ensure_ascii=False
        ),
    )

    # ── Generate fixed display template ───────────────────────────────────
    def _txt(item) -> str:
        return item["text"] if isinstance(item, dict) else str(item)

    def _reco_line(item) -> str:
        if isinstance(item, dict):
            be = item.get("brand_element", "")
            return f"- {item['text']}" + (f" [{be}]" if be else "")
        return f"- {item}"

    pf  = "\n".join(f"- {_txt(p)}" for p in result.get("points_forts",  [])) or "- Aucun point fort identifié."
    pfb = "\n".join(f"- {_txt(p)}" for p in result.get("points_faibles",[])) or "- Aucun point faible identifié."
    rec = "\n".join(_reco_line(r)   for r in result.get("recommandations",[])) or "- Aucune recommandation."

    mismatch_banner = (
        f"⚠ {result['brand_mismatch_note']}\n\n"
        if result.get("brand_mismatch") and result.get("brand_mismatch_note") else ""
    )
    display_text = mismatch_banner + f"""Clarity Score : {row.clarity_score} / 100

Détail :
Clarity : {row.sub_lisibilite} / 20
Alignment : {row.sub_alignment} / 20
Focus : {row.sub_focus} / 20
Tone : {row.sub_tone} / 20
Narrative Contribution : {row.sub_narrative_contribution} / 20

Narrative Risk : {row.narrative_risk}

Points forts :
{pf}

Points faibles :
{pfb}

Recommandations :
{rec}"""
    row.display_result = display_text
    db.add(row)
    db.commit()
    db.refresh(row)

    # ── Return ────────────────────────────────────────────────────────────
    return {
        "id":               row.id,
        "conversation_id":  row.conversation_id,
        "iteration_index":  row.iteration_index,
        **result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /analyze/stream — same analysis, streamed (Server-Sent Events)
# Identical setup, validation, score recompute, risk rule and persistence as
# /analyze. Only delivery differs: raw tokens are streamed as 'token' events for
# a live "typewriter" effect, then a final 'done' event carries the same complete
# validated JSON. DB save happens after full reception. Frontend falls back to
# the classic /analyze if the stream errors.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/analyze/stream")
def run_analysis_stream(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    bs_row = _load_brand_system_or_404(db, payload.brand_system_id, current_user)

    # ── Enforce analysis access (member / brand suspension) ───────────────
    _check_analysis_access(current_user, bs_row)

    # ── Abuse / cost controls (burst + per-tenant daily budget) ───────────
    _check_burst_limit(current_user.id)
    _check_tenant_budget(db, bs_row.client_id, current_user)

    brand_system_dict = _bs_row_to_v1(bs_row)
    message_dict = {
        "titre":  payload.message_title or payload.message_body[:60],
        "langue": payload.message_language or "fr",
        "corps":  payload.message_body.strip(),
    }
    metadata_dict = {
        "audience":          payload.audience,
        "canal":             payload.channel,
        "objectif":          payload.objective,
        "type_prise_parole": payload.content_type,
        # date key intentionally omitted → build_user_payload defaults to today
        "auteur":            (
            (current_user.full_name or current_user.email) if current_user else None
        ),
    }
    user_payload = build_user_payload(brand_system_dict, message_dict, metadata_dict)

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def event_stream():
        # ── 1. Stream raw tokens, accumulate the full response ────────────
        buffer = ""
        stream_usage: dict = {}
        try:
            for piece in stream_analyze(SYSTEM_PROMPT, user_payload, 1200, usage_out=stream_usage):
                buffer += piece
                yield _sse("token", {"t": piece})
        except Exception as exc:
            yield _sse("error", {"detail": f"stream: {exc}"})
            return

        # ── 2. Parse + validate exactly as the non-streamed path ──────────
        try:
            result = _parse_and_validate(
                buffer, metadata_dict, message_dict["corps"],
                brand_system_dict.get("nom_marque", ""),
            )
            # Token usage from the stream (or estimated from text if unavailable).
            _ptok, _ctok, _ttok = _resolve_tokens(
                stream_usage or None,
                prompt_text=SYSTEM_PROMPT + user_payload, completion_text=buffer,
            )
        except Exception:
            # Streamed output failed validation → canonical path (incl. repair),
            # guaranteeing an output identical to /analyze.
            try:
                result = analyze(brand_system_dict, message_dict, metadata_dict)
            except Exception as exc:
                yield _sse("error", {"detail": f"analysis: {exc}"})
                return
            _ptok, _ctok, _ttok = _resolve_tokens(
                result.pop("token_usage", None),
                prompt_text=SYSTEM_PROMPT + user_payload, completion_text=json.dumps(result, ensure_ascii=False),
            )

        # ── 3. Conversation threading + persist (identical to /analyze) ───
        try:
            if payload.conversation_id:
                conv_id  = payload.conversation_id
                iter_idx = db.query(Analysis).filter(
                    Analysis.conversation_id == conv_id
                ).count()
            else:
                conv_id  = str(uuid.uuid4())
                iter_idx = 0

            resolved_client_id = (
                bs_row.client_id
                or (current_user.client_id if current_user else None)
            )

            row = Analysis(
                client_id             = resolved_client_id,
                brand_system_id       = bs_row.id,
                parent_analysis_id    = payload.parent_analysis_id,
                conversation_id       = conv_id,
                iteration_index       = iter_idx,
                message_title         = message_dict["titre"],
                message_body          = message_dict["corps"],
                message_language      = message_dict.get("langue", "fr"),
                channel               = payload.channel,
                audience              = payload.audience,
                objective             = payload.objective,
                content_type          = payload.content_type,
                author                = metadata_dict.get("auteur"),
                campaign              = payload.campaign,
                analyzed_by           = (
                    (current_user.full_name or current_user.email)
                    if current_user else None
                ),
                analyzed_by_user_id   = current_user.id if current_user else None,
                clarity_score               = result.get("clarity_score", 0),
                sub_lisibilite              = result.get("sub_lisibilite", 0),
                sub_alignment               = result.get("sub_alignment", 0),
                sub_focus                   = result.get("sub_focus", 0),
                sub_tone                    = result.get("sub_tone", 0),
                sub_narrative_contribution  = result.get("sub_narrative_contribution", 0),
                narrative_risk              = result.get("narrative_risk", "Medium"),
                points_forts                = json.dumps(result.get("points_forts", []), ensure_ascii=False),
                points_faibles              = json.dumps(result.get("points_faibles", []), ensure_ascii=False),
                recommandations             = json.dumps(result.get("recommandations", []), ensure_ascii=False),
                raw_output                  = json.dumps(result, ensure_ascii=False),
                prompt_tokens               = _ptok,
                completion_tokens           = _ctok,
                total_tokens                = _ttok,
                prompt_version              = str(PROMPT_VERSION),
                brand_system_snapshot       = json.dumps(
                    {"version": bs_row.version, "content": brand_system_dict}, ensure_ascii=False
                ),
            )

            def _txt(item) -> str:
                return item["text"] if isinstance(item, dict) else str(item)

            def _reco_line(item) -> str:
                if isinstance(item, dict):
                    be = item.get("brand_element", "")
                    return f"- {item['text']}" + (f" [{be}]" if be else "")
                return f"- {item}"

            pf  = "\n".join(f"- {_txt(p)}" for p in result.get("points_forts",  [])) or "- Aucun point fort identifié."
            pfb = "\n".join(f"- {_txt(p)}" for p in result.get("points_faibles",[])) or "- Aucun point faible identifié."
            rec = "\n".join(_reco_line(r)   for r in result.get("recommandations",[])) or "- Aucune recommandation."

            mismatch_banner = (
                f"⚠ {result['brand_mismatch_note']}\n\n"
                if result.get("brand_mismatch") and result.get("brand_mismatch_note") else ""
            )
            row.display_result = mismatch_banner + f"""Clarity Score : {row.clarity_score} / 100

Détail :
Clarity : {row.sub_lisibilite} / 20
Alignment : {row.sub_alignment} / 20
Focus : {row.sub_focus} / 20
Tone : {row.sub_tone} / 20
Narrative Contribution : {row.sub_narrative_contribution} / 20

Narrative Risk : {row.narrative_risk}

Points forts :
{pf}

Points faibles :
{pfb}

Recommandations :
{rec}"""
            db.add(row)
            db.commit()
            db.refresh(row)
        except Exception as exc:
            yield _sse("error", {"detail": f"persist: {exc}"})
            return

        # ── 4. Final event: the same complete validated payload as /analyze
        yield _sse("done", {
            "id":              row.id,
            "conversation_id": row.conversation_id,
            "iteration_index": row.iteration_index,
            **result,
        })

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─────────────────────────────────────────────────────────────────────────────
# GET /analyses  — list (with role scoping & filters)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analyses")
def list_analyses(
    risk: Optional[str]           = Query(None),
    channel: Optional[str]        = Query(None),
    content_type: Optional[str]   = Query(None),
    date_from: Optional[str]      = Query(None),
    date_to:   Optional[str]      = Query(None),
    brand_system_id: Optional[int] = Query(None),
    user_email: Optional[str]     = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    q = db.query(Analysis)
    q = _apply_user_scope(q, current_user)
    if risk:             q = q.filter(Analysis.narrative_risk == risk)
    if channel:          q = q.filter(Analysis.channel == channel)
    if content_type:     q = q.filter(Analysis.content_type == content_type)
    if brand_system_id:  q = q.filter(Analysis.brand_system_id == brand_system_id)
    if user_email:
        # Filter by the stable authorship FK so same-name teammates aren't conflated.
        target = db.query(User).filter(User.email == user_email).first()
        q = q.filter(Analysis.analyzed_by_user_id == target.id) if target \
            else q.filter(Analysis.id.is_(None))
    if date_from:
        try:
            q = q.filter(Analysis.analyzed_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            end = datetime.fromisoformat(date_to)
            # A date-only "Au" bound (midnight) should include the whole end day,
            # otherwise same-day analyses are wrongly excluded.
            if (end.hour, end.minute, end.second) == (0, 0, 0):
                q = q.filter(Analysis.analyzed_at < end + timedelta(days=1))
            else:
                q = q.filter(Analysis.analyzed_at <= end)
        except ValueError:
            pass
    rows = q.order_by(Analysis.analyzed_at.desc()).all()
    return [_serialize(r, db) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# GET /analyses/stats
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analyses/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    q = db.query(Analysis)
    q = _apply_user_scope(q, current_user)
    rows = q.order_by(Analysis.analyzed_at.desc()).all()
    if not rows:
        return {
            "total": 0, "avg_score": 0, "last_score": None,
            "best_improvement": None, "avg_before_rewrite": None, "avg_after_rewrite": None,
            "top_scorers": [], "risk_distribution": empty_risk_distribution(),
        }

    scores = [r.clarity_score for r in rows]
    avg = sum(scores) / len(scores)
    last_score = rows[0].clarity_score if rows else None

    rewrites = [r for r in rows if r.parent_analysis_id]
    before_scores, after_scores, improvements = [], [], []
    for r in rewrites:
        parent = db.query(Analysis).filter(Analysis.id == r.parent_analysis_id).first()
        if parent:
            before_scores.append(parent.clarity_score)
            after_scores.append(r.clarity_score)
            improvements.append(r.clarity_score - parent.clarity_score)

    best_improvement   = max(improvements) if improvements else None
    weakest_improvement = min(improvements) if improvements else None
    avg_before = round(sum(before_scores) / len(before_scores), 1) if before_scores else None
    avg_after  = round(sum(after_scores)  / len(after_scores),  1) if after_scores  else None

    top_scorers = [
        {"title": r.message_title, "score": r.clarity_score,
         "date": r.analyzed_at.isoformat() if r.analyzed_at else None, "id": r.id}
        for r in rows if r.clarity_score >= 95
    ][:5]

    dist = risk_distribution(r.narrative_risk for r in rows)

    return {
        "total": len(rows),
        "avg_score": round(avg, 1),
        "last_score": last_score,
        "best_improvement": best_improvement,
        "weakest_improvement": weakest_improvement,
        "avg_before_rewrite": avg_before,
        "avg_after_rewrite": avg_after,
        "top_scorers": top_scorers,
        "risk_distribution": dist,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /analyses/{id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analyses/{analysis_id}")
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    q = db.query(Analysis).filter(Analysis.id == analysis_id)
    q = _apply_user_scope(q, current_user)
    row = q.first()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    data = _serialize(row, db)
    data["points_forts"]    = json.loads(row.points_forts)
    data["points_faibles"]  = json.loads(row.points_faibles)
    data["recommandations"] = json.loads(row.recommandations)
    # reasoning + brand-ownership notice live in raw_output (no dedicated DB column)
    data["reasoning"] = {}
    data["brand_mismatch"] = False
    data["brand_mismatch_note"] = ""
    if row.raw_output:
        try:
            raw = json.loads(row.raw_output)
            data["reasoning"] = raw.get("reasoning", {})
            data["brand_mismatch"] = bool(raw.get("brand_mismatch", False))
            data["brand_mismatch_note"] = raw.get("brand_mismatch_note", "")
        except Exception:
            pass
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Conversation history
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/history/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
    brand_system_id: Optional[int] = Query(None),
    user_email: Optional[str] = Query(None),
):
    """Return one summary row per conversation, ordered by most recent."""
    q = db.query(Analysis)
    q = _apply_user_scope(q, current_user)
    if brand_system_id is not None:
        q = q.filter(Analysis.brand_system_id == brand_system_id)
    if user_email is not None:
        # Filter by the stable authorship FK so same-name teammates aren't conflated.
        target_user = db.query(User).filter(User.email == user_email).first()
        q = q.filter(Analysis.analyzed_by_user_id == target_user.id) if target_user \
            else q.filter(Analysis.id.is_(None))
    rows = q.order_by(Analysis.analyzed_at.asc()).all()

    groups: dict[str, dict] = {}
    for r in rows:
        cid = r.conversation_id if r.conversation_id else f"solo-{r.id}"
        bs  = db.query(BrandSystem).filter(BrandSystem.id == r.brand_system_id).first()
        if cid not in groups:
            groups[cid] = {
                "conversation_id":   cid,
                "first_title":       r.message_title,
                "brand_system_name": bs.brand_name if bs else "—",
                "brand_system_id":   r.brand_system_id,
                "iteration_count":   0,
                "highest_score":     r.clarity_score,
                "last_risk":         r.narrative_risk or "faible",
                "last_date":         r.analyzed_at.isoformat() if r.analyzed_at else None,
                "first_date":        r.analyzed_at.isoformat() if r.analyzed_at else None,
                "contributors":      set(),
            }
        g = groups[cid]
        g["iteration_count"] += 1
        if r.clarity_score > g["highest_score"]:
            g["highest_score"] = r.clarity_score
        g["last_risk"] = r.narrative_risk or "faible"
        g["last_date"] = r.analyzed_at.isoformat() if r.analyzed_at else None
        if r.analyzed_by:
            g["contributors"].add(r.analyzed_by)

    def _resolve_name(val: str | None) -> str | None:
        if not val:
            return val
        if "@" in val:
            u = db.query(User).filter(User.email == val).first()
            if u and u.full_name:
                return u.full_name
        return val

    for g in groups.values():
        raw_contribs = sorted(g.pop("contributors"))
        resolved = [_resolve_name(e) or e for e in raw_contribs]
        g["analyzed_by"]       = resolved[0] if resolved else None
        g["contributor_count"] = len(resolved)
        g["contributors"]      = resolved

    result = sorted(groups.values(), key=lambda x: x["last_date"] or "", reverse=True)
    return result


@router.get("/history/{conversation_id}")
def get_conversation_thread(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    """Return all analyses in a conversation thread, ordered by iteration_index."""
    if conversation_id.startswith("solo-"):
        try:
            analysis_id = int(conversation_id[5:])
        except ValueError:
            raise HTTPException(status_code=404, detail="Conversation not found")
        q = db.query(Analysis).filter(Analysis.id == analysis_id)
        q = _apply_user_scope(q, current_user)
        row = q.first()
        rows = [row] if row else []
    else:
        q = (
            db.query(Analysis)
            .filter(Analysis.conversation_id == conversation_id)
        )
        q = _apply_user_scope(q, current_user)
        rows = q.order_by(Analysis.iteration_index.asc()).all()

    if not rows:
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = []
    for r in rows:
        d = _serialize(r, db)
        d["conversation_id"]  = r.conversation_id or conversation_id
        d["iteration_index"]  = r.iteration_index if r.iteration_index is not None else 0
        d["points_forts"]    = json.loads(r.points_forts)
        d["points_faibles"]  = json.loads(r.points_faibles)
        d["recommandations"] = json.loads(r.recommandations)
        d["reasoning"] = {}
        d["brand_mismatch"] = False
        d["brand_mismatch_note"] = ""
        if r.raw_output:
            try:
                raw = json.loads(r.raw_output)
                d["reasoning"] = raw.get("reasoning", {})
                d["brand_mismatch"] = bool(raw.get("brand_mismatch", False))
                d["brand_mismatch_note"] = raw.get("brand_mismatch_note", "")
            except Exception:
                pass
        result.append(d)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Serializer
# ─────────────────────────────────────────────────────────────────────────────

def _serialize(row: Analysis, db: Session) -> dict:
    bs = db.query(BrandSystem).filter(BrandSystem.id == row.brand_system_id).first()
    analyst = row.analyzed_by
    if analyst and "@" in analyst:
        u = db.query(User).filter(User.email == analyst).first()
        if u and u.full_name:
            analyst = u.full_name

    clamp_sub   = lambda val: max(0, min(val, 20))  if val is not None else None
    clamp_score = lambda val: max(0, min(val, 100)) if val is not None else None

    return {
        "id":                         row.id,
        "brand_system_id":            row.brand_system_id,
        "brand_system_name":          bs.brand_name if bs else "—",
        "message_title":              row.message_title,
        "message_body":               row.message_body,
        "message_language":           row.message_language,
        "channel":                    row.channel,
        "content_type":               row.content_type,
        "clarity_score":              clamp_score(row.clarity_score),
        "sub_lisibilite":             clamp_sub(row.sub_lisibilite),
        "sub_alignment":              clamp_sub(row.sub_alignment),
        "sub_focus":                  clamp_sub(row.sub_focus),
        "sub_tone":                   clamp_sub(row.sub_tone),
        "sub_narrative_contribution": clamp_sub(row.sub_narrative_contribution),
        "narrative_risk":             row.narrative_risk,
        "parent_analysis_id":         row.parent_analysis_id,
        "conversation_id":            row.conversation_id,
        "iteration_index":            row.iteration_index,
        "analyzed_at":                row.analyzed_at.isoformat() if row.analyzed_at else None,
        "analyzed_by":                analyst,
    }
