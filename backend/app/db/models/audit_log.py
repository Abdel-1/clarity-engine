"""Admin audit trail.

One immutable row per privileged mutation (create/delete/role-change/password
reset/suspend). Actor identity is denormalised (actor_email/actor_role) so the
record survives even if the acting user is later deleted. Written inside the same
transaction as the action it describes, so it can never drift from reality.
"""
import json
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_email   = Column(String, nullable=True)   # denormalised — survives user deletion
    actor_role    = Column(String, nullable=True)
    action        = Column(String, nullable=False)  # e.g. "client.delete", "user.role_change"
    target_type   = Column(String, nullable=True)   # "client" | "user" | "brand_system"
    target_id     = Column(String, nullable=True)
    client_id     = Column(Integer, nullable=True)  # affected tenant (for filtering)
    detail        = Column(Text, nullable=True)     # optional JSON string with context
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


def record_audit(
    db,
    *,
    actor,
    action: str,
    target_type: str | None = None,
    target_id=None,
    client_id: int | None = None,
    detail=None,
):
    """Stage an audit entry on the session. The caller commits it together with the
    action it describes (so the log is atomic with the change). Never raises on a
    bad ``detail`` value — auditing must not break the underlying operation."""
    if isinstance(detail, (dict, list)):
        try:
            detail = json.dumps(detail, ensure_ascii=False)
        except Exception:
            detail = str(detail)
    entry = AuditLog(
        actor_user_id=getattr(actor, "id", None),
        actor_email=getattr(actor, "email", None),
        actor_role=getattr(actor, "role", None),
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        client_id=client_id,
        detail=detail,
    )
    db.add(entry)
    return entry
