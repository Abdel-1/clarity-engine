from fastapi import APIRouter, UploadFile, File

from app.services.file_service import save_file
from app.services.tasks import process_document

router = APIRouter()


@router.post("/upload")
def upload_file(file: UploadFile = File(...)):

    # 1. Save file to disk
    file_path = save_file(file)

    # 2. Dispatch async Celery task
    task = process_document.delay(str(file_path))

    return {
        "task_id": task.id,
        "filename": file.filename,
        "message": "File uploaded — analysis running in background",
    }
