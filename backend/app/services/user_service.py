from sqlalchemy.orm import Session
from app.db.models.user import User
from app.core.security import hash_password, verify_password


class UserService:

    def create_user(self, db: Session, email: str, password: str):
        hashed = hash_password(password)

        user = User(
            email=email,
            hashed_password=hashed
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    def authenticate_user(self, db: Session, email: str, password: str):
        user = db.query(User).filter(User.email == email).first()

        if not user:
            return None

        if not verify_password(password, user.hashed_password):
            return None

        return user
