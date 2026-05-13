"""
One-time script: Create a Technopark client account.
Run from backend/ folder:
  python create_technopark_user.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.db.models.user import User
from app.db.models.client import Client
from app.db.models.brand_system import BrandSystem
from app.core.security import hash_password

EMAIL    = "technopark@clarity.com"
PASSWORD = "Technopark2025"

db = SessionLocal()

# 1. Find or create the Technopark client record
client = db.query(Client).filter(Client.company_name.ilike("%technopark%")).first()
if not client:
    client = Client(company_name="Technopark", sector="Innovation & Business")
    db.add(client); db.commit(); db.refresh(client)
    print(f"[OK] Created client: Technopark (id={client.id})")
else:
    print(f"[OK] Found existing client: {client.company_name} (id={client.id})")

# 2. Link the Technopark brand system to this client
bs = db.query(BrandSystem).filter(BrandSystem.brand_name.ilike("%technopark%")).first()
if bs:
    bs.client_id = client.id
    db.commit()
    print(f"[OK] Linked brand system '{bs.brand_name}' to client id={client.id}")
else:
    print("[WARN] No Technopark brand system found.")

# 3. Create the user (or update if already exists)
existing = db.query(User).filter(User.email == EMAIL).first()
if existing:
    existing.hashed_password = hash_password(PASSWORD)
    existing.role = "client"
    existing.client_id = client.id
    db.commit()
    print(f"[OK] Updated existing user: {EMAIL}")
else:
    user = User(
        email=EMAIL,
        hashed_password=hash_password(PASSWORD),
        full_name="Technopark",
        role="client",
        client_id=client.id,
    )
    db.add(user); db.commit()
    print(f"[OK] Created user: {EMAIL}")

db.close()
print("\n--- Done! ---")
print(f"Email:    {EMAIL}")
print(f"Password: {PASSWORD}")
print(f"Role:     client (chat + profile only)")
print(f"Client:   {client.company_name} (id={client.id})")

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.db.models.user import User
from app.db.models.client import Client
from app.db.models.brand_system import BrandSystem
from app.core.security import hash_password

EMAIL    = "technopark@clarity.com"
PASSWORD = "Technopark2025"

db = SessionLocal()

# 1. Find or create the Technopark client record
client = db.query(Client).filter(Client.company_name.ilike("%technopark%")).first()
if not client:
    client = Client(company_name="Technopark", sector="Innovation & Business")
    db.add(client); db.commit(); db.refresh(client)
    print(f"✅ Created client: Technopark (id={client.id})")
else:
    print(f"✅ Found existing client: {client.company_name} (id={client.id})")

# 2. Link the Technopark brand system to this client
bs = db.query(BrandSystem).filter(BrandSystem.brand_name.ilike("%technopark%")).first()
if bs:
    bs.client_id = client.id
    db.commit()
    print(f"✅ Linked brand system '{bs.brand_name}' to client id={client.id}")
else:
    print("⚠️  No Technopark brand system found — link manually after creation.")

# 3. Create the user (or update if already exists)
existing = db.query(User).filter(User.email == EMAIL).first()
if existing:
    existing.hashed_password = hash_password(PASSWORD)
    existing.role = "client"
    existing.client_id = client.id
    db.commit()
    print(f"✅ Updated existing user: {EMAIL}")
else:
    user = User(
        email=EMAIL,
        hashed_password=hash_password(PASSWORD),
        full_name="Technopark",
        role="client",
        client_id=client.id,
    )
    db.add(user); db.commit()
    print(f"✅ Created user: {EMAIL}")

db.close()
print("\n🎉 Done!")
print(f"   Email:    {EMAIL}")
print(f"   Password: {PASSWORD}")
print(f"   Role:     client (chat + profile only)")
print(f"   Client:   {client.company_name} (id={client.id})")
