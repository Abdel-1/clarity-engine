from celery import Celery

# Create Celery instance (task queue system)
celery = Celery(
    "clarity_engine",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=['app.services.tasks']
)
