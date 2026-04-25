import json

from app.core.celery_app import celery
from app.services.text_service import extract_text
from app.services.chunk_service import chunk_text
from app.services.ai_service import AIService

from app.db.session import SessionLocal
from app.db.models.analysis_result import AnalysisResult
from app.db.models.document import Document
ai = AIService()

@celery.task
def process_document(file_path: str):

    text = extract_text(file_path)
    chunks = chunk_text(text)

    full_text = "\n".join(chunks)

    result = ai.summarize_text(full_text)

    db = SessionLocal()

    row = AnalysisResult(
        document_id=1,   # temporary for now
        summary=result.get("summary", ""),
        entities=json.dumps(result.get("entities", [])),
        risks=json.dumps(result.get("risks", [])),
        decisions=json.dumps(result.get("decisions", []))
    )

    db.add(row)
    db.commit()
    db.close()

    return result
