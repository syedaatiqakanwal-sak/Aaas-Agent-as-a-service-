from uuid import UUID

from app.core.exceptions import NotFoundError
from app.db.models.agent import Agent
from app.repositories.agent_repo import AgentRepository
from app.schemas.agent import AgentCreate


class AgentService:
    def __init__(self, repo: AgentRepository) -> None:
        self.repo = repo

    async def create(self, data: AgentCreate) -> Agent:
        agent = Agent(
            slug=data.slug,
            name=data.name,
            system_prompt=data.system_prompt,
            model=data.model,
            is_active=data.is_active,
        )
        return await self.repo.add(agent)

    async def get(self, id: UUID) -> Agent:
        agent = await self.repo.get(id)
        if agent is None:
            raise NotFoundError("Agent not found")
        return agent

    async def list_active(self, limit: int = 100, offset: int = 0) -> list[Agent]:
        return await self.repo.list_active(limit=limit, offset=offset)

    async def get_active(self, ref: str) -> Agent:
        agent: Agent | None
        try:
            agent = await self.repo.get(UUID(ref))
        except ValueError:
            agent = await self.repo.get_by_slug(ref)
        if agent is None or not agent.is_active:
            raise NotFoundError("Agent not found")
        return agent
