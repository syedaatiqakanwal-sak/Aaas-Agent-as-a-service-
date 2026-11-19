"""Prometheus metrics are mounted from app.main at /api/v1/metrics."""

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator


def setup_metrics(app: FastAPI) -> None:
    Instrumentator().instrument(app).expose(
        app,
        endpoint="/api/v1/metrics",
        include_in_schema=False,
    )
