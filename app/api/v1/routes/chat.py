from fastapi import APIRouter, Depends
from langchain_core.messages import AIMessage, HumanMessage

from app.core.exceptions import AppException
from app.core.logger import get_logger
from app.dependencies.auth import get_current_user_id
from app.dependencies.db import get_agent_service, get_session_service
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.agent_engine import get_agent, reply_text
from app.services.agent_service import AgentService
from app.services.memory_service import load_messages, save_messages
from app.services.session_service import SessionService

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)


def _history_messages(records: list) -> list:
    messages = []
    for record in records:
        if not isinstance(record, dict):
            continue
        content = str(record.get("content") or "")
        if not content:
            continue
        if record.get("role") == "assistant":
            messages.append(AIMessage(content=content))
        else:
            messages.append(HumanMessage(content=content))
    return messages


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    agents: AgentService = Depends(get_agent_service),
    sessions: SessionService = Depends(get_session_service),
) -> ChatResponse:
    agent = await agents.get_active(payload.agent_id)
    session = await sessions.get(user_id, payload.session_id)
    stored = (session.context_data or {}).get("messages") or []
    history = await load_messages(user_id, payload.session_id, stored)
    public_id = agent.slug or str(agent.id)
    try:
        result = await get_agent().ainvoke(
            {
                "messages": [*_history_messages(history), HumanMessage(content=payload.message)],
                "user_id": user_id,
                "agent_id": public_id,
                "context": "",
                "system_prompt": agent.system_prompt,
                "model": agent.model,
            }
        )
    except AppException:
        raise
    except Exception as exc:
        logger.warning("agent_run_failed", error=str(exc))
        raise AppException("The agent could not complete this turn") from exc
    answer = reply_text(result["messages"])
    updated = [*history, {"role": "user", "content": payload.message}, {"role": "assistant", "content": answer}]
    await save_messages(user_id, payload.session_id, updated)
    await sessions.update_context(user_id, payload.session_id, {"messages": updated[-50:]})
    return ChatResponse(session_id=payload.session_id, agent_id=public_id, message=answer)
