from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    agent_id: str = Field(min_length=1, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentRead(DocumentCreate):
    id: UUID
    user_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def read_metadata_column(cls, value: Any) -> Any:
        if isinstance(value, dict) or not hasattr(value, "metadata_"):
            return value
        return {
            "id": value.id,
            "title": value.title,
            "content": value.content,
            "user_id": value.user_id,
            "agent_id": value.agent_id,
            "metadata": value.metadata_ or {},
            "created_at": value.created_at,
        }
