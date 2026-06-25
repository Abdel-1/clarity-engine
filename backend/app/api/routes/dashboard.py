"""Dashboard KPI endpoints — all metrics computed server-side.

Three endpoint groups:
  /api/dashboard/member   → team member (role=client)
  /api/brand/dashboard    → brand admin  (role=brand_admin)
  /api/admin/dashboard    → super admin  (role=admin)
"""
import json, statistics
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import settings
from app.core.dependencies.db import get_db
from app.core.dependencies.auth import require_client, require_brand_admin, require_admin
from app.db.models.user import User, ROLE_CLIENT
from app.db.models.client import Client
from app.db.models.analyses import Analysis
from app.db.models.brand_system import BrandSystem

router = APIRouter()
brand_dashboard_router = APIRouter()

# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

SUB_LABELS = {
    "sub_lisibilite": "Clarté",
    "sub_alignment": "Alignement",
    "sub_focus": "Focus",
    "sub_tone": "Ton",
    "sub_narrative_contribution": "Contribution narrative",
}

def _pass_fail(analyses: list[Analysis]) -> dict:
    """>=75 = pass."""
    passed = sum(1 for a in analyses if a.clarity_score >= 75)
    total = len(analyses)
    return {"passed": passed, "failed": total - passed, "total": total,
            "pass_rate": round(passed / total * 100, 1) if total else 0}


def _is_high_risk(risk: str | None) -> bool:
    if not risk:
        return False
    return risk.lower().replace('é', 'e') in ("high", "eleve")


def _risk_rate(analyses: list[Analysis]) -> dict:
    high = sum(1 for a in analyses if _is_high_risk(a.narrative_risk))
    total = len(analyses)
    return {"high_count": high, "total": total,
            "rate": round(high / total * 100, 1) if total else 0}


def _score_trend(analyses: list[Analysis], limit: int = 20, bs_names: dict | None = None) -> list[dict]:
    """Return chronological [{id, date, score, title, brand_system_id, brand_system_name}].
    When bs_names (brand_system_id → brand_name) is provided, each point is tagged
    with its brand system so the UI can filter the trend by brand."""
    names = bs_names or {}
    sorted_a = sorted(analyses, key=lambda a: a.analyzed_at or "")
    return [{"id": a.id, "date": a.analyzed_at.isoformat()[:10] if a.analyzed_at else None,
             "score": a.clarity_score, "title": a.message_title[:40],
             "analyzed_by": a.analyzed_by,
             "brand_system_id": a.brand_system_id,
             "brand_system_name": names.get(a.brand_system_id)}
            for a in sorted_a[-limit:]]


def _score_distribution(analyses: list[Analysis]) -> dict:
    buckets = {"0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0}
    for a in analyses:
        s = a.clarity_score
        if s < 25: buckets["0-25"] += 1
        elif s < 50: buckets["25-50"] += 1
        elif s < 75: buckets["50-75"] += 1
        else: buckets["75-100"] += 1
    return buckets


def _weakest_criteria(analyses: list[Analysis], first_only: bool = True) -> list[dict]:
    """Average each sub-score and return sorted worst→best. Values are clamped to
    [0, 20] to guard against legacy data.

    first_only=True averages first submissions only (iteration_index == 0) to avoid
    inflation from rewrites; first_only=False averages across all analyses.
    """
    if not analyses:
        return []
    source = analyses
    if first_only:
        # Only first submissions to avoid inflation from rewrites
        source = [a for a in analyses if (a.iteration_index is None or a.iteration_index == 0)] or analyses
    sums: dict[str, list[float]] = defaultdict(list)
    for a in source:
        for field, label in SUB_LABELS.items():
            raw = getattr(a, field, 0) or 0
            # Clamp to /20 scale — normalize legacy /100 data
            val = min(raw, 20) if raw <= 20 else round(raw * 20 / 100, 1)
            sums[label].append(val)
    result = [{"criterion": k, "avg": round(sum(v)/len(v), 1), "max": 20}
              for k, v in sums.items()]
    result.sort(key=lambda x: x["avg"])
    return result


def _improvements(analyses: list[Analysis], db: Session) -> list[int]:
    """Return list of score deltas for rewrites."""
    deltas = []
    for a in analyses:
        if a.parent_analysis_id:
            parent = db.query(Analysis).filter(Analysis.id == a.parent_analysis_id).first()
            if parent:
                deltas.append(a.clarity_score - parent.clarity_score)
    return deltas


def _avg_score_start(analyses: list[Analysis]) -> float | None:
    """Avg score at first submission (iteration_index == 0)."""
    firsts = [a for a in analyses if (a.iteration_index is None or a.iteration_index == 0)]
    if not firsts:
        return None
    return round(sum(a.clarity_score for a in firsts) / len(firsts), 1)


def _avg_score_end(analyses: list[Analysis]) -> float | None:
    """Avg score of the last iteration per conversation."""
    by_convo: dict[str, list] = defaultdict(list)
    for a in analyses:
        key = a.conversation_id or f"solo-{a.id}"
        by_convo[key].append(a)
    last_scores = []
    for items in by_convo.values():
        items.sort(key=lambda x: x.iteration_index or 0)
        last_scores.append(items[-1].clarity_score)
    if not last_scores:
        return None
    return round(sum(last_scores) / len(last_scores), 1)


def _avg_iterations_per_user(analyses: list[Analysis]) -> dict[str, float]:
    """For each user, compute avg number of iterations across their conversations."""
    # Group conversations by user
    user_convos: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for a in analyses:
        user = a.analyzed_by or "Inconnu"
        key = a.conversation_id or f"solo-{a.id}"
        user_convos[user][key].append(a)
    result: dict[str, float] = {}
    for user, convos in user_convos.items():
        lengths = [len(items) for items in convos.values()]
        result[user] = round(sum(lengths) / len(lengths), 1) if lengths else 1.0
    return result


def _first_pass_rate(analyses: list[Analysis]) -> float:
    """% of first-iteration analyses (iteration_index=0 or no parent) scoring >=75."""
    firsts = [a for a in analyses if not a.parent_analysis_id and (a.iteration_index is None or a.iteration_index == 0)]
    if not firsts:
        return 0
    passed = sum(1 for a in firsts if a.clarity_score >= 75)
    return round(passed / len(firsts) * 100, 1)


def _unreviewed_high_risk(analyses: list[Analysis], db: Session, bs_names: dict | None = None) -> list[dict]:
    """High-risk analyses that have no child (no rewrite follow-up).
    When bs_names (brand_system_id → brand_name) is provided, each item is tagged
    with its brand system so the UI can filter by brand."""
    names = bs_names or {}
    high = [a for a in analyses if _is_high_risk(a.narrative_risk)]
    unreviewed = []
    for a in high:
        child = db.query(Analysis).filter(Analysis.parent_analysis_id == a.id).first()
        if not child:
            unreviewed.append({
                "id": a.id,
                "title": a.message_title,
                "score": a.clarity_score,
                "date": a.analyzed_at.isoformat()[:10] if a.analyzed_at else None,
                "author": a.analyzed_by,
                "brand_system_id": a.brand_system_id,
                "brand_system_name": names.get(a.brand_system_id),
            })
    return unreviewed[:10]


def _score_by_dimension(analyses: list[Analysis], dimension: str) -> list[dict]:
    """Group analyses by a field (channel/content_type) and avg score."""
    groups: dict[str, list[int]] = defaultdict(list)
    for a in analyses:
        val = getattr(a, dimension, None) or "Non spécifié"
        groups[val].append(a.clarity_score)
    return [{"label": k, "avg_score": round(sum(v)/len(v), 1), "count": len(v)}
            for k, v in sorted(groups.items(), key=lambda x: -sum(x[1])/len(x[1]))]


# ═══════════════════════════════════════════════════════════════════════════
# 1. TEAM MEMBER DASHBOARD  (/api/dashboard/member)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dashboard/member")
def member_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    """Full KPI payload for the team member dashboard."""
    # Member self-scope keys off the stable authorship FK (analyzed_by_user_id),
    # not the spoofable analyzed_by label. Mirrors _apply_user_scope in analysis.py.
    analyses = (
        db.query(Analysis)
        .filter(
            Analysis.client_id == current_user.client_id,
            Analysis.analyzed_by_user_id == current_user.id,
        )
        .order_by(Analysis.analyzed_at.desc())
        .all()
    )

    scores = [a.clarity_score for a in analyses]
    deltas = _improvements(analyses, db)

    # Consistency = 100 - stdev (higher = more consistent)
    consistency = round(100 - statistics.stdev(scores), 1) if len(scores) >= 2 else None

    # Most problematic criterion
    weak = _weakest_criteria(analyses)
    most_problematic = weak[0]["criterion"] if weak else None

    # Top 5 >=95
    top5 = [{"id": a.id, "title": a.message_title, "score": a.clarity_score,
             "date": a.analyzed_at.isoformat()[:10] if a.analyzed_at else None}
            for a in analyses if a.clarity_score >= 95][:5]

    unreviewed = _full_unreviewed(analyses, db)

    return {
        # HIGH
        "score_trend": _score_trend(analyses, 20),
        "pass_fail": _pass_fail(analyses),
        "risk_rate": _risk_rate(analyses),
        "best_improvement": max(deltas) if deltas else None,
        "weakest_improvement": min(deltas) if deltas else None,
        "top_scorers": top5,
        "total": len(analyses),
        "avg_score": round(sum(scores)/len(scores), 1) if scores else 0,
        "avg_score_start": _avg_score_start(analyses),
        "avg_score_end": _avg_score_end(analyses),
        "unreviewed_count": len(unreviewed),
        # MED
        "first_pass_rate": _first_pass_rate(analyses),
        "most_problematic_criterion": most_problematic,
        "improvement_velocity": round(sum(deltas)/len(deltas), 1) if deltas else None,
        "consistency_score": consistency,
        "weak_criteria": weak,
        "score_by_channel": _score_by_dimension(analyses, "channel"),
        "score_by_type": _score_by_dimension(analyses, "content_type"),
    }


# ═══════════════════════════════════════════════════════════════════════════
# 2. BRAND ADMIN DASHBOARD  (/api/brand/dashboard)
# ═══════════════════════════════════════════════════════════════════════════

@brand_dashboard_router.get("/dashboard")
def brand_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """Full KPI payload for the brand admin dashboard."""
    cid = current_user.client_id
    analyses = db.query(Analysis).filter(Analysis.client_id == cid)\
                 .order_by(Analysis.analyzed_at.desc()).all()
    scores = [a.clarity_score for a in analyses]
    deltas = _improvements(analyses, db)

    # Risk concentration by user
    risk_by_user: dict[str, dict] = defaultdict(lambda: {"high": 0, "total": 0})
    for a in analyses:
        user_key = a.analyzed_by or "Inconnu"
        risk_by_user[user_key]["total"] += 1
        if _is_high_risk(a.narrative_risk):
            risk_by_user[user_key]["high"] += 1
    risk_concentration = [
        {"user": k, "high": v["high"], "total": v["total"],
         "rate": round(v["high"]/v["total"]*100, 1) if v["total"] else 0}
        for k, v in sorted(risk_by_user.items(), key=lambda x: -x[1]["high"])
    ]

    # Submissions + Avg Score per user
    user_stats: dict[str, dict] = defaultdict(lambda: {"scores": [], "count": 0})
    for a in analyses:
        key = a.analyzed_by or "Inconnu"
        user_stats[key]["scores"].append(a.clarity_score)
        user_stats[key]["count"] += 1
    user_avg_iters = _avg_iterations_per_user(analyses)
    per_user = [
        {"user": k, "count": v["count"],
         "avg_score": round(sum(v["scores"])/len(v["scores"]), 1),
         "avg_iterations": user_avg_iters.get(k, 1.0)}
        for k, v in sorted(user_stats.items(), key=lambda x: -x[1]["count"])
    ]

    # Resubmission rate
    with_parent = sum(1 for a in analyses if a.parent_analysis_id)
    resubmission_rate = round(with_parent / len(analyses) * 100, 1) if analyses else 0

    # Time-to-acceptable: avg iterations in conversations to first >=75
    convos: dict[str, list] = defaultdict(list)
    for a in analyses:
        cid_key = a.conversation_id or f"solo-{a.id}"
        convos[cid_key].append(a)
    iterations_to_pass = []
    for items in convos.values():
        items.sort(key=lambda x: x.iteration_index or 0)
        for i, a in enumerate(items):
            if a.clarity_score >= 75:
                iterations_to_pass.append(i + 1)
                break
    avg_iterations = round(sum(iterations_to_pass)/len(iterations_to_pass), 1) if iterations_to_pass else None

    # Collaboration rate: % conversations with >1 contributor
    multi_contrib = 0
    for items in convos.values():
        contributors = set(a.analyzed_by for a in items if a.analyzed_by)
        if len(contributors) > 1:
            multi_contrib += 1
    collab_rate = round(multi_contrib / len(convos) * 100, 1) if convos else 0

    # Average sub-score per criterion across ALL analyses (not just first submissions)
    weak = _weakest_criteria(analyses, first_only=False)

    client = db.query(Client).filter(Client.id == current_user.client_id).first()

    return {
        "company_name": client.company_name if client else "",
        "total": len(analyses),
        "avg_score": round(sum(scores)/len(scores), 1) if scores else 0,
        "avg_score_start": _avg_score_start(analyses),
        "avg_score_end": _avg_score_end(analyses),
        # HIGH
        "score_trend": _score_trend(analyses, 20),
        "score_distribution": _score_distribution(analyses),
        "risk_rate": _risk_rate(analyses),
        "pass_fail": _pass_fail(analyses),
        "most_violated_rules": weak[:3],
        "high_risk_frequency": sum(1 for a in analyses if a.narrative_risk == "High"),
        "risk_concentration": risk_concentration[:5],
        "unreviewed_high_risk": _unreviewed_high_risk(analyses, db),
        # MED
        "weak_criteria": weak,
        "per_user": per_user,
        "first_pass_rate": _first_pass_rate(analyses),
        "score_by_channel": _score_by_dimension(analyses, "channel"),
        "score_by_type": _score_by_dimension(analyses, "content_type"),
        "resubmission_rate": resubmission_rate,
        "avg_iterations_to_pass": avg_iterations,
        "collaboration_rate": collab_rate,
        "best_improvement": max(deltas) if deltas else None,
        "weakest_improvement": min(deltas) if deltas else None,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 3. ADMIN PANEL DASHBOARD  (/api/admin/dashboard)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/admin/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Full KPI payload for the super-admin dashboard."""
    all_analyses = db.query(Analysis).order_by(Analysis.analyzed_at.desc()).all()
    clients = db.query(Client).all()
    all_users = db.query(User).filter(User.role == ROLE_CLIENT).all()
    # brand_system_id → brand_name, so trend points & unreviewed items can be
    # tagged with their brand system for the front-end filters.
    bs_names = {bs.id: bs.brand_name for bs in db.query(BrandSystem).all()}

    # Brand Health Score per tenant
    client_map: dict[int, dict] = {}
    for c in clients:
        c_analyses = [a for a in all_analyses if a.client_id == c.id]
        c_scores = [a.clarity_score for a in c_analyses]
        c_high = sum(1 for a in c_analyses if _is_high_risk(a.narrative_risk))
        c_unrev = _unreviewed_high_risk(c_analyses, db)
        c_deltas = _improvements(c_analyses, db)
        # avg iterations per conversation for this client
        c_convos: dict[str, list] = defaultdict(list)
        for a in c_analyses:
            c_convos[a.conversation_id or f"solo-{a.id}"].append(a)
        c_iter_lengths = [len(v) for v in c_convos.values()]
        c_avg_iter = round(sum(c_iter_lengths)/len(c_iter_lengths), 1) if c_iter_lengths else None
        c_pass = sum(1 for s in c_scores if s >= 75)
        client_map[c.id] = {
            "client_id": c.id,
            "company_name": c.company_name,
            "total_analyses": len(c_analyses),
            "avg_score": round(sum(c_scores)/len(c_scores), 1) if c_scores else 0,
            "pass_rate": round(c_pass/len(c_scores)*100, 1) if c_scores else 0,
            "high_risk_count": c_high,
            "unreviewed_high_risk_count": len(c_unrev),
            "avg_improvement": round(sum(c_deltas)/len(c_deltas), 1) if c_deltas else None,
            "avg_iterations": c_avg_iter,
        }
    brand_health = sorted(client_map.values(), key=lambda x: -x["avg_score"])

    # High-Risk Frequency all tenants
    total_high = sum(1 for a in all_analyses if _is_high_risk(a.narrative_risk))

    # Unreviewed High-Risk all tenants
    all_unreviewed = _unreviewed_high_risk(all_analyses, db, bs_names)

    # Submissions + Avg Score per User
    user_perf: dict[str, dict] = defaultdict(lambda: {"scores": [], "count": 0, "client_id": None})
    for a in all_analyses:
        key = a.analyzed_by or "Inconnu"
        user_perf[key]["scores"].append(a.clarity_score)
        user_perf[key]["count"] += 1
        user_perf[key]["client_id"] = a.client_id
    per_user_all = []
    for k, v in sorted(user_perf.items(), key=lambda x: -x[1]["count"]):
        client_name = client_map.get(v["client_id"], {}).get("company_name", "—") if v["client_id"] else "—"
        per_user_all.append({
            "user": k, "count": v["count"],
            "avg_score": round(sum(v["scores"])/len(v["scores"]), 1),
            "company_name": client_name,
        })

    # Governance Coverage: % of clients with >0 analyses
    active_clients = sum(1 for c in client_map.values() if c["total_analyses"] > 0)
    coverage = round(active_clients / len(clients) * 100, 1) if clients else 0

    # Cross-user Alignment Gap per client
    alignment_gaps = []
    for c in clients:
        c_user_avgs = []
        c_analyses = [a for a in all_analyses if a.client_id == c.id]
        by_user: dict[str, list[int]] = defaultdict(list)
        for a in c_analyses:
            by_user[a.analyzed_by or "?"].append(a.clarity_score)
        for scores in by_user.values():
            c_user_avgs.append(sum(scores)/len(scores))
        gap = round(statistics.stdev(c_user_avgs), 1) if len(c_user_avgs) >= 2 else 0
        alignment_gaps.append({"company_name": c.company_name, "gap": gap, "user_count": len(c_user_avgs)})
    alignment_gaps.sort(key=lambda x: -x["gap"])

    all_scores = [a.clarity_score for a in all_analyses]

    all_unrev_count = len(all_unreviewed)

    return {
        "total_analyses": len(all_analyses),
        "total_clients": len(clients),
        "total_users": len(all_users),
        "avg_score": round(sum(all_scores)/len(all_scores), 1) if all_scores else 0,
        "avg_score_start": _avg_score_start(all_analyses),
        "avg_score_end": _avg_score_end(all_analyses),
        "unreviewed_count": all_unrev_count,
        # HIGH
        "brand_health": brand_health,
        "high_risk_frequency": total_high,
        "high_risk_rate": round(total_high/len(all_analyses)*100, 1) if all_analyses else 0,
        "unreviewed_high_risk": all_unreviewed,
        "per_user": per_user_all[:15],
        # MED
        "governance_coverage": coverage,
        "alignment_gaps": alignment_gaps[:10],
        "score_distribution": _score_distribution(all_analyses),
        "score_trend": _score_trend(all_analyses, 30, bs_names),
    }


# ═══════════════════════════════════════════════════════════════════════════
# 4. ADMIN — API TOKEN CONSUMPTION  (/api/admin/token-usage)
#    % of API tokens consumed per brand system, with date-range + brand filters.
# ═══════════════════════════════════════════════════════════════════════════

def _parse_day(s: str | None, end_of_day: bool = False):
    """Parse 'YYYY-MM-DD' → datetime (or None if absent/invalid)."""
    if not s:
        return None
    try:
        dt = datetime.strptime(s.strip(), "%Y-%m-%d")
        return dt.replace(hour=23, minute=59, second=59) if end_of_day else dt
    except ValueError:
        return None


def _token_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Money spent for a given token split, using the configured per-1M rates.
    Input (prompt) and output (completion) are billed at different rates."""
    cost = (prompt_tokens     * settings.TOKEN_INPUT_PRICE_PER_1M
            + completion_tokens * settings.TOKEN_OUTPUT_PRICE_PER_1M) / 1_000_000
    return round(cost, 4)


@router.get("/admin/token-usage")
def admin_token_usage(
    start:  str | None = Query(None, description="Date de début incluse (YYYY-MM-DD)"),
    end:    str | None = Query(None, description="Date de fin incluse (YYYY-MM-DD)"),
    brand_system_id: int | None = Query(None, description="Filtrer par Brand System"),
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Token consumption per brand system, as % of total, with date + brand filters.

    Note: token figures exist only for analyses run after token tracking was added;
    older analyses report 0. Values are real provider usage, or a chars/4 estimate
    when the provider didn't return usage (streaming)."""
    bs_names = {bs.id: bs.brand_name for bs in db.query(BrandSystem).all()}

    # ── Filtered set for the breakdown ────────────────────────────────────
    q = db.query(Analysis)
    start_dt, end_dt = _parse_day(start), _parse_day(end, end_of_day=True)
    if start_dt:
        q = q.filter(Analysis.analyzed_at >= start_dt)
    if end_dt:
        q = q.filter(Analysis.analyzed_at <= end_dt)
    if brand_system_id:
        q = q.filter(Analysis.brand_system_id == brand_system_id)
    analyses = q.all()

    # ── Aggregate tokens per brand system ─────────────────────────────────
    agg: dict[int, dict] = defaultdict(lambda: {"total": 0, "prompt": 0, "completion": 0, "count": 0})
    grand = 0
    for a in analyses:
        t = a.total_tokens or 0
        agg[a.brand_system_id]["total"]      += t
        agg[a.brand_system_id]["prompt"]     += a.prompt_tokens or 0
        agg[a.brand_system_id]["completion"] += a.completion_tokens or 0
        agg[a.brand_system_id]["count"]      += 1
        grand += t

    by_brand = sorted((
        {
            "brand_system_id":   bid,
            "brand_system_name": bs_names.get(bid, f"#{bid}"),
            "total_tokens":      v["total"],
            "prompt_tokens":     v["prompt"],
            "completion_tokens": v["completion"],
            "analyses":          v["count"],
            "pct":               round(v["total"] / grand * 100, 1) if grand else 0.0,
            "cost":              _token_cost(v["prompt"], v["completion"]),
        }
        for bid, v in agg.items()
    ), key=lambda x: -x["total_tokens"])

    grand_cost = round(sum(b["cost"] for b in by_brand), 4)

    # ── Brand-system list for the filter (all known, sorted by name) ──────
    brand_systems = [
        {"id": bid, "name": name}
        for bid, name in sorted(bs_names.items(), key=lambda x: x[1].lower())
    ]

    return {
        "grand_total_tokens": grand,
        "grand_total_cost":   grand_cost,
        "total_analyses":     len(analyses),
        "by_brand":           by_brand,
        "brand_systems":      brand_systems,
        "pricing": {
            "input_per_1m":  settings.TOKEN_INPUT_PRICE_PER_1M,
            "output_per_1m": settings.TOKEN_OUTPUT_PRICE_PER_1M,
            "currency":      settings.TOKEN_COST_CURRENCY,
        },
        "filters":            {"start": start, "end": end, "brand_system_id": brand_system_id},
    }


# ═══════════════════════════════════════════════════════════════════════════
# UNREVIEWED HIGH-RISK  — dedicated endpoints (no cap, role-scoped)
# ═══════════════════════════════════════════════════════════════════════════

def _full_unreviewed(analyses: list[Analysis], db: Session) -> list[dict]:
    """Return ALL high-risk analyses with no child iteration — no cap."""
    high = [a for a in analyses if _is_high_risk(a.narrative_risk)]
    result = []
    for a in high:
        child = db.query(Analysis).filter(Analysis.parent_analysis_id == a.id).first()
        if not child:
            result.append({
                "id": a.id,
                "title": a.message_title,
                "score": a.clarity_score,
                "date": a.analyzed_at.isoformat()[:10] if a.analyzed_at else None,
                "author": a.analyzed_by,
                "conversation_id": a.conversation_id,
            })
    return result


@router.get("/dashboard/unreviewed")
def member_unreviewed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client),
):
    """All unreviewed high-risk analyses for the current member."""
    # Member self-scope keys off the stable authorship FK, not the analyzed_by label.
    analyses = db.query(Analysis).filter(
        Analysis.client_id == current_user.client_id,
        Analysis.analyzed_by_user_id == current_user.id,
    ).all()
    return _full_unreviewed(analyses, db)


@brand_dashboard_router.get("/unreviewed")
def brand_unreviewed(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    """All unreviewed high-risk analyses for the brand admin's organisation."""
    analyses = db.query(Analysis).filter(Analysis.client_id == current_user.client_id).all()
    return _full_unreviewed(analyses, db)


@router.get("/admin/unreviewed")
def admin_unreviewed(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """All unreviewed high-risk analyses across every organisation."""
    analyses = db.query(Analysis).all()
    return _full_unreviewed(analyses, db)
