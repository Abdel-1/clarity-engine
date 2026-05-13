from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.db.base import Base

ROLE_ADMIN       = "admin"
ROLE_BRAND_ADMIN = "brand_admin"
ROLE_CLIENT      = "client"
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, default="client", nullable=False)  # "admin" | "client"
    client_id       = Column(Integer, nullable=True)   # links to clients.id
    created_at      = Column(DateTime, default=datetime.utcnow)
