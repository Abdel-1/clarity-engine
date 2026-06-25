from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.core.dependencies.db import get_db
from app.services.user_service import UserService
from app.core.dependencies.auth import get_current_user
from app.db.models.user import User
from app.core.security import (
    hash_password, verify_password, password_policy_error, create_access_token,
)
from app.core.identity import sync_author_identity

router = APIRouter()
service = UserService()

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "client_id": user.client_id,
        "analysis_enabled": user.analysis_enabled,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

@router.put("/me/profile")
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    old_full_name, old_email = user.full_name, user.email

    if payload.email and payload.email != user.email:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        user.email = payload.email

    if payload.full_name is not None:
        user.full_name = payload.full_name

    # Propagate the new identity to past analyses (history, dashboards, scoping…)
    sync_author_identity(
        db,
        old_full_name=old_full_name, old_email=old_email,
        new_full_name=user.full_name, new_email=user.email,
    )

    db.commit()
    db.refresh(user)
    return {"message": "Profil mis à jour", "user": {"email": user.email, "full_name": user.full_name}}

@router.put("/me/password")
def update_password(
    payload: PasswordUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    pw_err = password_policy_error(payload.new_password)
    if pw_err:
        raise HTTPException(status_code=400, detail=pw_err)

    user.hashed_password = hash_password(payload.new_password)
    # Invalidate every OTHER existing session for this user. Truncate to whole
    # seconds so the fresh token below (whose iat is a whole-second unix stamp) is
    # not itself caught by the cutoff. This session just re-authenticated with the
    # current password, so we keep it alive by returning a new token.
    user.tokens_valid_after = datetime.utcnow().replace(microsecond=0)
    db.commit()
    db.refresh(user)
    new_token = create_access_token({
        "user_id": user.id, "role": user.role, "email": user.email,
        "client_id": user.client_id,
    })
    return {"message": "Mot de passe mis à jour avec succès", "access_token": new_token}
