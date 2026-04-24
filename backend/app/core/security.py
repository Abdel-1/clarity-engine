from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

from app.core.config import settings

# Password hashing system (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password before storing
def hash_password(password: str):
    return pwd_context.hash(password)

# Verify password during login
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


# Create JWT token
def create_access_token(data: dict, expires_minutes: int = 60):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm="HS256"
    )

    return encoded_jwt


# Decode JWT token
def decode_token(token: str):
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"]
        )
        return payload
    except JWTError:
        return None
