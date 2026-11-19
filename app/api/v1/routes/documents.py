from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.dependencies.auth import get_current_user_id
from app.dependencies.db import get_document_service
from app.schemas.document import DocumentCreate, DocumentRead
from app.services.document_service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentRead, status_code=201)
async def create_document(
    payload: DocumentCreate,
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> DocumentRead:
    document = await service.create(user_id, payload)
    return DocumentRead.model_validate(document)


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: UUID,
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> DocumentRead:
    document = await service.get(user_id, document_id)
    return DocumentRead.model_validate(document)


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    agent_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> list[DocumentRead]:
    documents = await service.list(user_id, agent_id=agent_id, limit=limit, offset=offset)
    return [DocumentRead.model_validate(document) for document in documents]


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    user_id: str = Depends(get_current_user_id),
    service: DocumentService = Depends(get_document_service),
) -> Response:
    await service.delete(user_id, document_id)
    return Response(status_code=204)
