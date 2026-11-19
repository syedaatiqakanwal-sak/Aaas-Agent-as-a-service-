from uuid import UUID

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=255)
    session_id: UUID
    message: str = Field(min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    session_id: UUID
    agent_id: str
    message: str
