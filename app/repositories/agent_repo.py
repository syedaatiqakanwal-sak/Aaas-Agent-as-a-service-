from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.agent import Agent
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[Agent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Agent)

    async def list_active(self, limit: int = 100, offset: int = 0) -> list[Agent]:
        statement = (
            select(Agent)
            .where(Agent.is_active.is_(True))
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> Agent | None:
        statement = select(Agent).where(Agent.slug == slug)
        result = await self.session.execute(statement)
        return result.scalars().first()
