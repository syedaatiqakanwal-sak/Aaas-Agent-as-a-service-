from uuid import UUID

from app.core.exceptions import NotFoundError
from app.db.models.document import Document
from app.repositories.document_repo import DocumentRepository
from app.schemas.document import DocumentCreate


class DocumentService:
    def __init__(self, repo: DocumentRepository) -> None:
        self.repo = repo

    async def create(self, user_id: str, data: DocumentCreate) -> Document:
        document = Document(
            title=data.title,
            content=data.content,
            user_id=user_id,
            agent_id=data.agent_id,
            metadata_=data.metadata,
        )
        return await self.repo.add(document)

    async def get(self, user_id: str, id: UUID) -> Document:
        document = await self.repo.get(id)
        if document is None or document.user_id != user_id:
            raise NotFoundError("Document not found")
        return document

    async def list(
        self,
        user_id: str,
        agent_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Document]:
        return await self.repo.list_for_user(
            user_id,
            agent_id=agent_id,
            limit=limit,
            offset=offset,
        )

    async def delete(self, user_id: str, id: UUID) -> None:
        await self.get(user_id, id)
        await self.repo.delete(id)
