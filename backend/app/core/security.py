import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

from app.core.config import settings


# Minimum password policy, enforced wherever a human chooses a password
# (self-service change + admin/brand-admin provisioning & resets).
PASSWORD_MIN_LENGTH = 8


def password_policy_error(password: str) -> str | None:
    """Return a human-readable French reason if the password is too weak, else None.

    Policy: at least PASSWORD_MIN_LENGTH characters, with at least one letter and
    one digit. Intentionally modest so it strengthens security without blocking
    reasonable passwords.
    """
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        return f"Le mot de passe doit contenir au moins {PASSWORD_MIN_LENGTH} caractères."
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        return "Le mot de passe doit contenir au moins une lettre et un chiffre."
    return None


# Hash password before storing (using bcrypt directly — passlib 1.7.4 + bcrypt 5.x incompatible)
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# Verify password during login
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Guard empty/None and malformed hashes → return False (caller yields 401, not 500)
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# Create JWT token
def create_access_token(data: dict, expires_minutes: int = 60):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes)
    # iat (issued-at) lets the server revoke tokens minted before a per-user cutoff
    # (tokens_valid_after) — see get_current_user. Stored as a UTC unix timestamp.
    to_encode.update({"exp": expire, "iat": int(now.timestamp())})

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
