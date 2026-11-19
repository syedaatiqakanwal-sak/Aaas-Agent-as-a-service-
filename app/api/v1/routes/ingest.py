from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import AppException, PayloadTooLargeError, ValidationError
from app.core.logger import get_logger
from app.dependencies.auth import get_current_user_id
from app.dependencies.db import get_document_service
from app.schemas.document import DocumentCreate, DocumentRead
from app.services.document_service import DocumentService
from app.services.rag_service import add_document_to_vector_db

router = APIRouter(prefix="/ingest", tags=["ingest"])
logger = get_logger(__name__)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024


async def _read_limited(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise PayloadTooLargeError("File exceeds the 5MB limit")
        chunks.append(chunk)
    return b"".join(chunks)


def _document_from_upload(
    file_name: str | None,
    data: bytes,
    content_type: str | None,
    agent_id: str,
) -> DocumentCreate:
    text = data.decode("utf-8", errors="ignore")
    if not text:
        raise ValidationError("Uploaded file has no readable content")
    title = (file_name or "upload")[:255] or "upload"
    try:
        return DocumentCreate(
            title=title,
            content=text,
            agent_id=agent_id,
            metadata={"size": len(data), "content_type": content_type},
        )
    except PydanticValidationError as exc:
        raise ValidationError("Uploaded file is not a valid document") from exc


@router.post("/upload", response_model=DocumentRead)
async def upload(
    file: UploadFile,
    agent_id: str = Form("default"),
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> DocumentRead:
    try:
        data = await _read_limited(file)
        created = await service.create(
            user_id,
            _document_from_upload(file.filename, data, file.content_type, agent_id),
        )
        await add_document_to_vector_db(user_id, agent_id, created.content)
        return DocumentRead.model_validate(created)
    except AppException:
        raise
    except Exception as exc:
        logger.warning("ingest_upload_failed", error=str(exc))
        raise AppException("Failed to ingest file") from exc


@router.post("/upload-multi", response_model=list[DocumentRead])
async def upload_multi(
    files: list[UploadFile] = File(...),
    agent_id: str = Form("default"),
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> list[DocumentRead]:
    try:
        created: list[DocumentRead] = []
        for file in files:
            data = await _read_limited(file)
            document = await service.create(
                user_id,
                _document_from_upload(file.filename, data, file.content_type, agent_id),
            )
            await add_document_to_vector_db(user_id, agent_id, document.content)
            created.append(DocumentRead.model_validate(document))
        return created
    except AppException:
        raise
    except Exception as exc:
        logger.warning("ingest_upload_multi_failed", error=str(exc))
        raise AppException("Failed to ingest files") from exc
