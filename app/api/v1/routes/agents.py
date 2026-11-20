from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user_id
from app.dependencies.db import get_agent_service
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.services.agent_service import AgentService

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=AgentRead, status_code=201)
async def create_agent(
    payload: AgentCreate,
    user_id: str = Depends(get_current_user_id),
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    _ = user_id
    agent = await service.create(payload)
    return AgentRead.model_validate(agent)


@router.get("", response_model=list[AgentRead])
async def list_agents(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
    service: AgentService = Depends(get_agent_service),
) -> list[AgentRead]:
    _ = user_id
    agents = await service.list_active(limit=limit, offset=offset)
    return [AgentRead.model_validate(agent) for agent in agents]


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(
    agent_id: UUID,
    user_id: str = Depends(get_current_user_id),
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    _ = user_id
    agent = await service.get(agent_id)
    return AgentRead.model_validate(agent)


@router.patch("/{agent_id}", response_model=AgentRead)
async def update_agent(
    agent_id: UUID,
    payload: AgentUpdate,
    user_id: str = Depends(get_current_user_id),
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    _ = user_id
    agent = await service.update(agent_id, payload)
    return AgentRead.model_validate(agent)


@router.delete("/{agent_id}", response_model=AgentRead)
async def deactivate_agent(
    agent_id: UUID,
    user_id: str = Depends(get_current_user_id),
    service: AgentService = Depends(get_agent_service),
) -> AgentRead:
    _ = user_id
    agent = await service.deactivate(agent_id)
    return AgentRead.model_validate(agent)
