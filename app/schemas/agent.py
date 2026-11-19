from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    system_prompt: str = Field(min_length=1)
    model: str = Field(default="gpt-4o", min_length=1, max_length=100)
    is_active: bool = True


class AgentRead(AgentCreate):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
