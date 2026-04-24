from app.db.session import SessionLocal

# This function gives a DB session per request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
