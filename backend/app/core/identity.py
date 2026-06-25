"""Keep denormalised author labels in sync with the canonical User row.

Analyses store the author as a plain string (``analyzed_by`` / ``author``),
captured as *(full_name or email)* at analysis time. When a user later changes
their name or email those stored strings would keep showing the old identity, so
this module re-points them whenever the user is edited — making a profile change
apply across the whole platform (history, dashboards, PDF exports, scoping…).
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.analyses import Analysis


def display_name(full_name: str | None, email: str | None) -> str | None:
    """The label captured on an analysis: full name if set, otherwise email."""
    return full_name or email


def sync_author_identity(
    db: Session,
    *,
    old_full_name: str | None,
    old_email: str | None,
    new_full_name: str | None,
    new_email: str | None,
) -> int:
    """Re-point past analyses authored under the user's old name/email to their
    new display label. Returns the number of analyses touched. The caller is
    responsible for committing the surrounding transaction.
    """
    new_label = display_name(new_full_name, new_email)
    if not new_label:
        return 0

    # Any label a past analysis could have stored for this user, except the
    # already-correct new one.
    targets = {v for v in (old_full_name, old_email) if v and v != new_label}
    if not targets:
        return 0

    rows = (
        db.query(Analysis)
        .filter(or_(Analysis.analyzed_by.in_(targets), Analysis.author.in_(targets)))
        .all()
    )
    for r in rows:
        if r.analyzed_by in targets:
            r.analyzed_by = new_label
        if r.author in targets:
            r.author = new_label
    return len(rows)
