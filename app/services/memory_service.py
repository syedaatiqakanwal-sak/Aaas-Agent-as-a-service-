import json
from uuid import UUID

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


def _key(user_id: str, session_id: UUID) -> str:
    return f"session:{user_id}:{session_id}"


async def _redis():
    from redis.asyncio import Redis

    return Redis.from_url(
        settings.REDIS_URL,
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=True,
    )


async def load_messages(user_id: str, session_id: UUID, fallback: list) -> list:
    try:
        client = await _redis()
        try:
            raw = await client.get(_key(user_id, session_id))
        finally:
            await client.aclose()
        if raw:
            loaded = json.loads(raw)
            if isinstance(loaded, list):
                return loaded
    except Exception as exc:
        logger.warning("redis_memory_unavailable", error=str(exc))
    return list(fallback or [])


async def save_messages(user_id: str, session_id: UUID, messages: list) -> None:
    payload = json.dumps(messages[-50:])
    try:
        client = await _redis()
        try:
            await client.set(_key(user_id, session_id), payload, ex=60 * 60 * 24 * 7)
        finally:
            await client.aclose()
    except Exception as exc:
        logger.warning("redis_memory_write_failed", error=str(exc))
