from fastapi import APIRouter, UploadFile, File

from app.services.file_service import save_file
from app.services.tasks import process_document

router = APIRouter()

@router.post("/upload")
def upload_file(file: UploadFile = File(...)):

    # Save file
    file_path = save_file(file)

    # SEND TO BACKGROUND WORKER (NOT blocking)
    task = process_document.delay(file_path)

    return {
        "message": "File uploaded successfully",
        "task_id": task.id
    }
