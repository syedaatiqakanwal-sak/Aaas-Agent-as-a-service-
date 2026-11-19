import hashlib
import secrets
from typing import Annotated

from fastapi import Header

from app.core.config import settings
from app.core.exceptions import UnauthorizedError


def _key_index(raw: str) -> dict[str, str]:
    index: dict[str, str] = {}
    for item in raw.split(","):
        entry = item.strip()
        if ":" not in entry:
            continue
        key, user_id = entry.split(":", 1)
        key = key.strip()
        user_id = user_id.strip()
        if not key or not user_id:
            continue
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        index[digest] = user_id
    return index


def user_id_for_api_key(presented: str) -> str | None:
    presented_digest = hashlib.sha256(presented.encode("utf-8")).hexdigest()
    matched: str | None = None
    for digest, user_id in _key_index(settings.API_KEYS).items():
        if secrets.compare_digest(presented_digest, digest):
            matched = user_id
    return matched


async def get_current_user_id(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str:
    if not x_api_key:
        raise UnauthorizedError("API key required")
    user_id = user_id_for_api_key(x_api_key)
    if user_id is None:
        raise UnauthorizedError("Invalid API key")
    return user_id
