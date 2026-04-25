import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.db.models.document import Document
from app.db.models.user import User

db = SessionLocal()

# Ensure at least one User and one Document exists
user = db.query(User).filter(User.id == 1).first()
if not user:
    user = User(email="test@example.com", hashed_password="pwd")
    db.add(user)
    db.commit()

doc = db.query(Document).filter(Document.id == 1).first()
if not doc:
    doc = Document(id=1, user_id=user.id, title="Test Doc", content="Content")
    db.add(doc)
    db.commit()
    print("Created dummy document with id=1")
else:
    print("Document with id=1 already exists")

db.close()
