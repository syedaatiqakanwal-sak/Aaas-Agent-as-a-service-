from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user_id
from app.dependencies.db import get_session_service
from app.schemas.session import SessionContextUpdate, SessionCreate, SessionRead
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead, status_code=201)
async def create_session(
    payload: SessionCreate,
    user_id: str = Depends(get_current_user_id),
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    session = await service.create(user_id, payload)
    return SessionRead.model_validate(session)


@router.get("/resolve", response_model=SessionRead)
async def resolve_session(
    agent_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    session = await service.get_or_create(user_id, agent_id)
    return SessionRead.model_validate(session)


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: UUID,
    user_id: str = Depends(get_current_user_id),
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    session = await service.get(user_id, session_id)
    return SessionRead.model_validate(session)


@router.patch("/{session_id}/context", response_model=SessionRead)
async def update_session_context(
    session_id: UUID,
    payload: SessionContextUpdate,
    user_id: str = Depends(get_current_user_id),
    service: SessionService = Depends(get_session_service),
) -> SessionRead:
    session = await service.update_context(user_id, session_id, payload.context_data)
    return SessionRead.model_validate(session)
