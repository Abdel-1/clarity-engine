from app.db.session import SessionLocal
from app.db.models.user import User, ROLE_ADMIN
from app.db.models import client, document, analysis_result, brand_system, analyses  # Ensure all tables are loaded
from app.core.security import hash_password

def seed_admin():
    db = SessionLocal()
    email = "admin@test.com"
    
    admin = db.query(User).filter(User.email == email).first()
    if not admin:
        admin = User(
            email=email,
            hashed_password=hash_password("admin123"),
            role=ROLE_ADMIN,
            full_name="Master Admin"
        )
        db.add(admin)
        db.commit()
        print(f"✅ Admin user created: {email} / admin123")
    else:
        print(f"ℹ️ Admin user '{email}' already exists.")
    db.close()

if __name__ == "__main__":
    seed_admin()
