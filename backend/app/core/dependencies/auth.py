from datetime import datetime
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.dependencies.db import get_db
from app.core.security import decode_token
from app.db.models.user import User, ROLE_ADMIN, ROLE_BRAND_ADMIN

# auto_error=False so that a missing/non-Bearer header yields our own 401
# (not the framework default), guaranteeing the frontend's handle401 redirect.
security = HTTPBearer(auto_error=False)


def get_current_user(
    token: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated User ORM row."""
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(token.credentials)
    if not payload or "user_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Server-side revocation: reject any token minted before the user's cutoff
    # (set on password change, role change, or "log out everywhere"). iat and
    # tokens_valid_after are both compared as naive UTC to avoid tz pitfalls.
    cutoff = getattr(user, "tokens_valid_after", None)
    iat = payload.get("iat")
    if cutoff is not None and iat is not None and datetime.utcfromtimestamp(iat) < cutoff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée, veuillez vous reconnecter.",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow only admin-role users through."""
    if current_user.role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_client(current_user: User = Depends(get_current_user)) -> User:
    """Allow any authenticated user (admin or client).

    A non-admin MUST belong to a tenant: without a client_id, every tenant-scoped
    query degenerates to `client_id IS NULL`, which would match orphaned/legacy
    rows across the platform. Admins legitimately have no client_id.
    """
    if current_user.role != ROLE_ADMIN and current_user.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aucun client associé à votre compte. Contactez votre administrateur.",
        )
    return current_user


def require_brand_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow only brand_admin-role users (scoped to a single client)."""
    if current_user.role != ROLE_BRAND_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brand admin access required",
        )
    # A brand admin with no tenant cannot be scoped safely.
    if current_user.client_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aucun client associé à ce compte brand admin.",
        )
    return current_user


def require_brand_admin_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow either brand_admin or super admin."""
    if current_user.role not in (ROLE_ADMIN, ROLE_BRAND_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted",
        )
    return current_user
