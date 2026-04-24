from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime

from app.db.base import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, ForeignKey("users.id"))

    title = Column(String)
    content = Column(Text)

    file_type = Column(String)  # pdf, docx, txt

    created_at = Column(DateTime, default=datetime.utcnow)
