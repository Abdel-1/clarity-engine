from app.core.celery_app import celery
from app.services.text_service import extract_text
from app.services.chunk_service import chunk_text
from app.services.ai_service import AIService

ai_service = AIService()


@celery.task
def process_document(file_path: str):

    # 1. Extract text
    text = extract_text(file_path)

    # 2. Chunk text
    chunks = chunk_text(text)

    # 3. Combine chunks (simple version for AI)
    full_text = "\n".join(chunks)

    # 4. AI processing
    ai_result = ai_service.summarize_text(full_text)

    return {
        "file_path": file_path,
        "chunks": len(chunks),
        "ai_analysis": ai_result
    }
