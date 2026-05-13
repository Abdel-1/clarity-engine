from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from app.core.dependencies.db import get_db
from app.core.security import decode_token
from app.db.models.user import User, ROLE_ADMIN

security = HTTPBearer()


def get_current_user(
    token=Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated User ORM row."""
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
    """Allow any authenticated user (admin or client)."""
    return current_user
