from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.db.base import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id                       = Column(Integer, primary_key=True, index=True)
    client_id                = Column(Integer, ForeignKey("clients.id"), nullable=True)
    brand_system_id          = Column(Integer, ForeignKey("brand_systems.id"), nullable=False)
    parent_analysis_id       = Column(Integer, ForeignKey("analyses.id"), nullable=True)  # tracks before/after rewrite

    message_title            = Column(String, nullable=False)
    message_body             = Column(Text,   nullable=False)
    message_language         = Column(String, default="fr")
    channel                  = Column(String, nullable=True)
    audience                 = Column(String, nullable=True)
    objective                = Column(String, nullable=True)
    content_type             = Column(String, nullable=True)
    author                   = Column(String, nullable=True)
    campaign                 = Column(String, nullable=True)

    clarity_score            = Column(Integer, nullable=False)   # overall /100
    sub_clarity              = Column(Integer, nullable=False)   # Readability /20
    sub_alignment            = Column(Integer, nullable=False)
    sub_focus                = Column(Integer, nullable=False)
    sub_tone                 = Column(Integer, nullable=False)
    sub_narrative_contribution = Column(Integer, nullable=False)
    narrative_risk           = Column(String,  nullable=True)    # kept for legacy, not displayed

    points_forts             = Column(Text, nullable=False)   # JSON array
    points_faibles           = Column(Text, nullable=False)
    recommandations          = Column(Text, nullable=False)
    raw_output               = Column(Text, nullable=True)

    analyzed_at              = Column(DateTime, default=datetime.utcnow)
    analyzed_by              = Column(String, nullable=True)
