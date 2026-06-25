from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

application = FastAPI(title=settings.APP_NAME)
app = application   # keep alias for uvicorn

# CORS — allowed origins come from settings.CORS_ORIGINS (env-overridable) so the
# same build works in dev and prod without code changes. Never pair "*" with
# credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Baseline security headers on every response. Cheap defence-in-depth; HSTS is
# only meaningful over HTTPS so it's emitted but harmless on plain HTTP in dev.
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
    )
    return response

@app.get("/")
def root():
    return {"message": "Clarity Engine is running", "app_name": settings.APP_NAME}

# ── DB bootstrap ───────────────────────────────────────────────────────────
from app.db.session import engine
from app.db.base import Base

# Import all models so SQLAlchemy creates their tables on startup
from app.db.models import user, document, analysis_result, client, brand_system, analyses, audit_log  # noqa

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # Run safe migrations (adds new nullable columns, promotes admin user)
    from app.db.migrations import run_migrations
    run_migrations()

@app.get("/health/db")
def db_health():
    return {"status": "database connected"}

# ── Routers ────────────────────────────────────────────────────────────────
from app.api.routes import user as user_router
from app.api.routes import auth, upload, tasks
from app.api.routes import brand_systems, analysis
from app.api.routes import admin
from app.api.routes.admin import brand_router
from app.api.routes import dashboard
from app.api.routes.dashboard import brand_dashboard_router
from app.api.routes import pdf as pdf_router

app.include_router(user_router.router, prefix="/api")
app.include_router(auth.router,        prefix="/api")
app.include_router(upload.router)
app.include_router(tasks.router)
app.include_router(brand_systems.router, prefix="/api")
app.include_router(analysis.router,      prefix="/api")
app.include_router(admin.router,         prefix="/api")
app.include_router(brand_router,         prefix="/api")
app.include_router(dashboard.router,     prefix="/api")
app.include_router(brand_dashboard_router, prefix="/api/brand")
app.include_router(pdf_router.router,     prefix="/api")
