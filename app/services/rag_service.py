import asyncio
import uuid

import tiktoken

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logger import get_logger

logger = get_logger(__name__)

COLLECTION_NAME = "knowledge"
_encoding = tiktoken.get_encoding("cl100k_base")


def _splitter():
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    return RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)


def _embeddings():
    if not settings.OPENAI_API_KEY:
        raise AppException(
            "OPENAI_API_KEY is required to embed knowledge",
            status_code=503,
        )
    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)


def _collection():
    import chromadb

    client = chromadb.PersistentClient(path=settings.CHROMA_PATH)
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _tenant_filter(user_id: str, agent_id: str) -> dict:
    return {"$and": [{"user_id": user_id}, {"agent_id": agent_id}]}


def _add_sync(user_id: str, agent_id: str, text: str) -> int:
    chunks = _splitter().split_text(text)
    chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
    if not chunks:
        return 0
    vectors = _embeddings().embed_documents(chunks)
    collection = _collection()
    collection.add(
        ids=[str(uuid.uuid4()) for _ in chunks],
        documents=chunks,
        embeddings=vectors,
        metadatas=[{"user_id": user_id, "agent_id": agent_id} for _ in chunks],
    )
    return len(chunks)


def _search_sync(user_id: str, agent_id: str, query: str, k: int = 4) -> str:
    if not query.strip():
        return ""
    vector = _embeddings().embed_query(query)
    collection = _collection()
    found = collection.query(
        query_embeddings=[vector],
        n_results=k,
        where=_tenant_filter(user_id, agent_id),
    )
    documents = (found.get("documents") or [[]])[0]
    text = "\n\n".join(part for part in documents if part)
    tokens = _encoding.encode(text)
    if len(tokens) > 3000:
        text = _encoding.decode(tokens[:3000])
    return text


async def add_document_to_vector_db(user_id: str, agent_id: str, text: str) -> int:
    count = await asyncio.to_thread(_add_sync, user_id, agent_id, text)
    logger.info("knowledge_indexed", user_id=user_id, agent_id=agent_id, chunks=count)
    return count


async def search_knowledge(user_id: str, agent_id: str, query: str) -> str:
    return await asyncio.to_thread(_search_sync, user_id, agent_id, query)
