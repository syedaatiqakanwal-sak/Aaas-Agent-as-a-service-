import re
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError, NotFoundError
from app.db.models.agent import Agent
from app.repositories.agent_repo import AgentRepository
from app.schemas.agent import AgentCreate, AgentUpdate

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slug_from_name(name: str) -> str:
    slug = _SLUG_RE.sub("-", name.strip().lower()).strip("-")
    return slug[:240] or "agent"


class AgentService:
    def __init__(self, repo: AgentRepository) -> None:
        self.repo = repo

    async def create(self, data: AgentCreate) -> Agent:
        agent = Agent(
            slug=await self._unique_slug(slug_from_name(data.name)),
            name=data.name,
            system_prompt=data.system_prompt,
            model=data.model,
            is_active=True,
        )
        try:
            return await self.repo.add(agent)
        except IntegrityError as exc:
            raise ConflictError("An agent with this name already exists") from exc

    async def get(self, agent_id: UUID) -> Agent:
        agent = await self.repo.get(agent_id)
        if agent is None:
            raise NotFoundError("Agent not found")
        return agent

    async def list_active(self, limit: int = 20, offset: int = 0) -> list[Agent]:
        return await self.repo.list_active(limit=limit, offset=offset)

    async def update(self, agent_id: UUID, data: AgentUpdate) -> Agent:
        agent = await self.get(agent_id)
        changes = data.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(agent, field, value)
        return await self.repo.update(agent)

    async def deactivate(self, agent_id: UUID) -> Agent:
        agent = await self.get(agent_id)
        agent.is_active = False
        return await self.repo.update(agent)

    async def get_active(self, ref: str) -> Agent:
        agent: Agent | None
        try:
            agent = await self.repo.get(UUID(ref))
        except ValueError:
            agent = await self.repo.get_by_slug(ref)
        if agent is None or not agent.is_active:
            raise NotFoundError("Agent not found")
        return agent

    async def _unique_slug(self, base: str) -> str:
        if await self.repo.get_by_slug(base) is None:
            return base
        for _ in range(5):
            candidate = f"{base[:230]}-{uuid4().hex[:8]}"
            if await self.repo.get_by_slug(candidate) is None:
                return candidate
        raise ConflictError("Could not allocate a unique agent slug")
