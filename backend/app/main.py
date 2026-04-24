from fastapi import FastAPI
from app.core.config import settings

# Create FastAPI app instance
app = FastAPI(title=settings.APP_NAME)

@app.get("/")
def root():
    return {
        "message": "Clarity Engine is running",
        "app_name": settings.APP_NAME,
        "debug": settings.DEBUG
    }

from app.db.session import engine
from app.db.base import Base

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health/db")
def db_health():
    return {"status": "database connected"}

from app.api.routes import user, auth, upload

# Include routers
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(upload.router)