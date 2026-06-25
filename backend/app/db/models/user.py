from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from app.db.base import Base

ROLE_ADMIN       = "admin"
ROLE_BRAND_ADMIN = "brand_admin"
ROLE_CLIENT      = "membre"    # renamed from "client"
ROLE_MEMBRE      = "membre"    # alias for readability
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default=ROLE_MEMBRE, nullable=False)  # "admin" | "brand_admin" | "membre"
    client_id       = Column(Integer, ForeignKey("clients.id"), nullable=True)
    # When False, the admin has suspended this member's access to the analysis
    # engine. They can still browse the platform; only the Analyze page is locked.
    analysis_enabled = Column(Boolean, default=True, nullable=False)
    # Token revocation cutoff (naive UTC): any access token whose iat is earlier than
    # this is rejected. Bumped on password change, role change and "log out everywhere".
    tokens_valid_after = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))
