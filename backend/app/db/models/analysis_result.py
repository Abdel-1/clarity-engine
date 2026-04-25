from sqlalchemy import Column, Integer, ForeignKey, Text
from app.db.base import Base

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))

    summary = Column(Text)
    entities = Column(Text)     # JSON string for now
    risks = Column(Text)
    decisions = Column(Text)
