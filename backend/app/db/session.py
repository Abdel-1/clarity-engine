from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Create database engine (connection to PostgreSQL/SQLite)
# Some hosts (Railway/Heroku) hand out the legacy "postgres://" scheme, which
# SQLAlchemy 2.0 rejects — normalise it to the modern "postgresql://" form.
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    engine = create_engine(db_url)

# Each request gets its own session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Dependency function for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
