from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

application = FastAPI(title=settings.APP_NAME)
app = application   # keep alias for uvicorn

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Clarity Engine is running", "app_name": settings.APP_NAME}

# ── DB bootstrap ───────────────────────────────────────────────────────────
from app.db.session import engine
from app.db.base import Base

# Import all models so SQLAlchemy creates their tables on startup
from app.db.models import user, document, analysis_result, client, brand_system, analyses  # noqa

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health/db")
def db_health():
    return {"status": "database connected"}

# ── Routers ────────────────────────────────────────────────────────────────
from app.api.routes import user as user_router
from app.api.routes import auth, upload, tasks
from app.api.routes import brand_systems, analysis

app.include_router(user_router.router)
app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(tasks.router)
app.include_router(brand_systems.router, prefix="/api")
app.include_router(analysis.router,      prefix="/api")