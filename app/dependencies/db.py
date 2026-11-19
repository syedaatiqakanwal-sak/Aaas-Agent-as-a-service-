from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.agent_repo import AgentRepository
from app.repositories.document_repo import DocumentRepository
from app.repositories.session_repo import SessionRepository
from app.services.agent_service import AgentService
from app.services.document_service import DocumentService
from app.services.session_service import SessionService


async def get_document_service(
    session: AsyncSession = Depends(get_db),
) -> DocumentService:
    return DocumentService(DocumentRepository(session))


async def get_session_service(
    session: AsyncSession = Depends(get_db),
) -> SessionService:
    return SessionService(SessionRepository(session))


async def get_agent_service(
    session: AsyncSession = Depends(get_db),
) -> AgentService:
    return AgentService(AgentRepository(session))
