from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies.db import get_db
from app.services.user_service import UserService

router = APIRouter()

service = UserService()

@router.post("/users")
def create_user(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    return service.create_user(db, email, password)


@router.get("/users")
def get_user(email: str, db: Session = Depends(get_db)):
    return service.get_user_by_email(db, email)

from app.core.dependencies.auth import get_current_user

@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return {"user": user}
