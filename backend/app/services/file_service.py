import os
import uuid

UPLOAD_DIR = "uploads"

# Save uploaded file securely
def save_file(file):
    # Create unique filename to avoid collisions
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    return file_path
