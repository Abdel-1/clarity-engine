from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies.db import get_db
from app.core.dependencies.auth import get_current_user
from app.db.models.user import User
from app.services.user_service import UserService
from app.core.security import create_access_token

router = APIRouter()
service = UserService()


# Credentials are sent in the JSON request body (never in the URL/query string).
class LoginRequest(BaseModel):
    email: str
    password: str


# NOTE: public self-registration has been removed deliberately.
# This is a multi-tenant B2B product: accounts must be provisioned by a super
# admin or a brand admin (see app/api/routes/admin.py), which assigns the user's
# client_id and role. An open /register endpoint created unscoped, NULL-tenant
# accounts that could then reach the analysis engine — do not re-introduce it.


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = service.authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    role = getattr(user, "role", "membre")
    token_data = {
        "user_id": user.id, 
        "role": role, 
        "email": user.email, 
        "client_id": user.client_id
    }
    token = create_access_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "client_id": user.client_id
    }


@router.post("/logout")
def logout(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Log out of ALL sessions: bumps the per-user revocation cutoff so every
    existing access token for this user (including the current one) stops working.
    The client should also clear its locally stored token."""
    user.tokens_valid_after = datetime.utcnow().replace(microsecond=0)
    db.commit()
    return {"message": "Déconnecté de toutes les sessions."}
