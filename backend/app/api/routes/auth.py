from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies.db import get_db
from app.services.user_service import UserService
from app.core.security import create_access_token

router = APIRouter()
service = UserService()


@router.post("/register")
def register(email: str, password: str, db: Session = Depends(get_db)):

    user = service.create_user(db, email, password)

    token = create_access_token({"user_id": user.id})

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.post("/login")
def login(email: str, password: str, db: Session = Depends(get_db)):

    user = service.authenticate_user(db, email, password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"user_id": user.id})

    return {
        "access_token": token,
        "token_type": "bearer"
    }
