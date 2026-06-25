import os

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.db.models.user import User, ROLE_ADMIN
# Import every model module so all tables are registered on the metadata before
# create_all() runs (mirrors the import list in app/main.py).
from app.db.models import (  # noqa: F401
    user, client, document, analysis_result, brand_system, analyses, audit_log,
)
from app.core.security import hash_password


def seed_admin():
    # Ensure the schema exists (idempotent) so this script is safe to run as a
    # one-off / pre-deploy step even against a brand-new, empty database.
    Base.metadata.create_all(bind=engine)

    # Credentials are configurable via env so a public deployment isn't stuck on
    # the well-known default. Set ADMIN_EMAIL / ADMIN_PASSWORD in the service.
    email = os.getenv("ADMIN_EMAIL", "admin@test.com")
    password = os.getenv("ADMIN_PASSWORD", "admin123")

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == email).first()
        if not admin:
            admin = User(
                email=email,
                hashed_password=hash_password(password),
                role=ROLE_ADMIN,
                full_name="Master Admin",
            )
            db.add(admin)
            db.commit()
            print(f"✅ Admin user created: {email}")
        else:
            print(f"ℹ️ Admin user '{email}' already exists.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
