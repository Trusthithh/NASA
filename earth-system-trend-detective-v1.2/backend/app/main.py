import logging
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, assistant, datasets, locations
from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Earth System Trend Detective API",
    description="Backend scientific analysis engine for NASA Space Apps Challenge",
    version="1.5.0",
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

# Small dependency-free per-process rate limiter for the paid AI endpoint.
# For multi-worker deployments, enforce the same limit at the gateway/shared store.
_assistant_hits = defaultdict(deque)
_assistant_lock = Lock()


@app.middleware("http")
async def limit_assistant_requests(request, call_next):
    if request.method == "POST" and request.url.path == "/api/v1/assistant/explain":
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        window = 60.0
        limit = max(1, settings.assistant_rate_limit_per_minute)
        with _assistant_lock:
            hits = _assistant_hits[client_ip]
            while hits and now - hits[0] >= window:
                hits.popleft()
            if len(hits) >= limit:
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Assistant rate limit reached. Please wait a minute and try again."},
                    headers={"Retry-After": "60"},
                )
            hits.append(now)
    return await call_next(request)


@app.get("/")
def root():
    return {"project": "Earth System Trend Detective", "status": "online", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
