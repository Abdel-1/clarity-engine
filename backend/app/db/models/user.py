from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime

from app.db.base import Base


ROLE_ADMIN  = "admin"
ROLE_CLIENT = "client"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String)
    hashed_password = Column(String, nullable=False)

    # Role-based access control
    role      = Column(String, nullable=False, default=ROLE_CLIENT)  # "admin" | "client"
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)  # NULL for admins

    created_at = Column(DateTime, default=datetime.utcnow)
