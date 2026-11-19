from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    agent_id: str = Field(min_length=1, max_length=255)
    context_data: dict[str, Any] = Field(default_factory=dict)


class SessionRead(SessionCreate):
    id: UUID
    user_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionContextUpdate(BaseModel):
    context_data: dict[str, Any] = Field(default_factory=dict)
