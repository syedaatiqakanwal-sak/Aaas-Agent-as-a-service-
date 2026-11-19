from uuid import UUID

from app.core.exceptions import NotFoundError
from app.db.models.session import UserSession
from app.repositories.session_repo import SessionRepository
from app.schemas.session import SessionCreate


class SessionService:
    def __init__(self, repo: SessionRepository) -> None:
        self.repo = repo

    async def create(self, user_id: str, data: SessionCreate) -> UserSession:
        session = UserSession(
            user_id=user_id,
            agent_id=data.agent_id,
            context_data=data.context_data,
        )
        return await self.repo.add(session)

    async def get(self, user_id: str, id: UUID) -> UserSession:
        session = await self.repo.get(id)
        if session is None or session.user_id != user_id:
            raise NotFoundError("Session not found")
        return session

    async def get_or_create(self, user_id: str, agent_id: str) -> UserSession:
        existing = await self.repo.get_by_user_agent(user_id, agent_id)
        if existing is not None:
            return existing
        return await self.create(user_id, SessionCreate(agent_id=agent_id))

    async def update_context(self, user_id: str, id: UUID, new_context: dict) -> UserSession:
        session = await self.get(user_id, id)
        merged = dict(session.context_data or {})
        merged.update(new_context)
        session.context_data = merged
        return await self.repo.update(session)
