import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, assistant, datasets, locations
from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Earth System Trend Detective API",
    description="Backend scientific analysis engine for NASA Space Apps Challenge",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (locations, datasets, analysis, assistant):
    app.include_router(module.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"project": "Earth System Trend Detective", "status": "online", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
