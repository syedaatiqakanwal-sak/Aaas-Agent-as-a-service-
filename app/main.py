from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from structlog.contextvars import bind_contextvars, clear_contextvars

from app.core.config import settings
from app.core.logger import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

from app.api.v1.routes import chat, documents, health, ingest, sessions
from app.api.v1.routes.metrics import setup_metrics
from app.core.exceptions import AppException
from app.db.base import Base
from app.db.models import Agent, Document, UserSession
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("app_startup", app=settings.APP_NAME, env=settings.APP_ENV)
    # Importing the model classes above registers them on Base.metadata.
    _ = (Agent, Document, UserSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.execute(
            text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS slug VARCHAR(255)")
        )
        await connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_agents_slug ON agents (slug)")
        )
    logger.info("database_connected")
    yield
    await engine.dispose()
    logger.info("app_shutdown")


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(ingest.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)


@app.exception_handler(AppException)
async def app_exc_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning(
        "app_exception",
        path=str(request.url.path),
        error=exc.__class__.__name__,
        detail=str(exc),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "detail": str(exc)},
    )


@app.exception_handler(RequestValidationError)
async def val_exc_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("request_validation_error", path=str(request.url.path))
    return JSONResponse(
        status_code=422,
        content={"error": "ValidationError", "detail": exc.errors()},
    )


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    clear_contextvars()
    bind_contextvars(request_id=request_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        clear_contextvars()


setup_metrics(app)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": f"{settings.APP_NAME} is running"}
