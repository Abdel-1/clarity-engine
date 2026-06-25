from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
import uuid
from datetime import datetime
from app.db.base import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id                       = Column(Integer, primary_key=True, index=True)
    client_id                = Column(Integer, ForeignKey("clients.id"), nullable=True)
    brand_system_id          = Column(Integer, ForeignKey("brand_systems.id"), nullable=False)
    parent_analysis_id       = Column(Integer, ForeignKey("analyses.id"), nullable=True)  # tracks before/after rewrite
    conversation_id          = Column(String, nullable=True)   # UUID grouping all iterations
    iteration_index          = Column(Integer, nullable=True, default=0)  # 0-based within conversation

    # Stable authorship link. analyzed_by (below) is a denormalised display label
    # and must NOT be used for authorization — this FK is. Set to the authoring
    # user's id at analysis time; backfilled for legacy rows in db/migrations.py.
    analyzed_by_user_id      = Column(Integer, ForeignKey("users.id"), nullable=True)

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
    sub_lisibilite           = Column(Integer, nullable=False, default=0) # Readability /20
    sub_alignment            = Column(Integer, nullable=False)
    sub_focus                = Column(Integer, nullable=False)
    sub_tone                 = Column(Integer, nullable=False)
    sub_narrative_contribution = Column(Integer, nullable=False)
    narrative_risk           = Column(String,  nullable=True)    # kept for legacy, not displayed

    points_forts             = Column(Text, nullable=False)   # JSON array
    points_faibles           = Column(Text, nullable=False)
    recommandations          = Column(Text, nullable=False)
    raw_output               = Column(Text, nullable=True)
    display_result           = Column(Text, nullable=True)    # The pre-rendered fixed template text
    # Version of the scoring system prompt that produced this analysis. Lets us tell
    # which prompt revision generated a historical score (spec: versioned prompt).
    prompt_version           = Column(String, nullable=True)
    # Immutable snapshot of the Brand System content actually scored against, as a
    # JSON object {"version": int, "content": {...v1 fields...}}. Guarantees history
    # stays accurate even if the Brand System is later edited in place (spec: history
    # immutable when the Brand System changes).
    brand_system_snapshot    = Column(Text, nullable=True)

    # API token consumption for this analysis (DeepSeek usage; estimated if the
    # provider didn't return usage). Used by the admin token-consumption panel.
    prompt_tokens            = Column(Integer, nullable=True)
    completion_tokens        = Column(Integer, nullable=True)
    total_tokens             = Column(Integer, nullable=True)

    analyzed_at              = Column(DateTime, default=datetime.utcnow)
    analyzed_by              = Column(String, nullable=True)
