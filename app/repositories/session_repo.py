from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.session import UserSession
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[UserSession]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, UserSession)

    async def get_by_user_agent(self, user_id: str, agent_id: str) -> UserSession | None:
        statement = select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.agent_id == agent_id,
        )
        result = await self.session.execute(statement)
        return result.scalars().first()
