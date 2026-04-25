from fastapi import APIRouter
from celery.result import AsyncResult

from app.core.celery_app import celery

router = APIRouter()


@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    task = AsyncResult(task_id, app=celery)

    response = {
        "task_id": task_id,
        "status": task.status,
    }

    if task.successful():
        response["result"] = task.result

    if task.failed():
        response["error"] = str(task.result)

    return response
