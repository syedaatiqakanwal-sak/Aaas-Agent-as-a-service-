from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    system_prompt: str = Field(min_length=1)
    model: str = Field(default="gemini-3.8-flash", min_length=1, max_length=100)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    system_prompt: str | None = Field(default=None, min_length=1)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class AgentRead(BaseModel):
    id: UUID
    slug: str
    name: str
    system_prompt: str
    model: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
