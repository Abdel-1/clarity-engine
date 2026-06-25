from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.db.base import Base

class BrandSystem(Base):
    __tablename__ = "brand_systems"

    id                = Column(Integer, primary_key=True, index=True)
    client_id         = Column(Integer, ForeignKey("clients.id"), nullable=True)
    version           = Column(Integer, default=1)

    brand_name        = Column(String, nullable=False)
    brand_role        = Column(Text,   nullable=False)
    master_statement  = Column(Text,   nullable=False)
    priorities        = Column(Text,   nullable=False)
    territories       = Column(Text,   nullable=False)
    tone              = Column(Text,   nullable=False)
    red_lines         = Column(Text,   nullable=False)
    words_preferred   = Column(Text,   nullable=True)
    words_avoid       = Column(Text,   nullable=True)
    audiences         = Column(Text,   nullable=True)
    sector            = Column(String, nullable=True)

    is_active         = Column(Boolean, default=True)
    # When False, the admin has suspended analysis for this brand system (e.g. it
    # consumed too many tokens). No member can analyse against it until re-enabled.
    analysis_enabled  = Column(Boolean, default=True, nullable=False)
    created_at        = Column(DateTime, default=datetime.utcnow)
    created_by        = Column(String, nullable=True)

    # Traceability for imported brand systems
    source_file         = Column(String, nullable=True)
    raw_extraction_json = Column(Text,   nullable=True)

