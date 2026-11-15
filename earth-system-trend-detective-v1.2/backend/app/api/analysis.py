import logging
from typing import Awaitable, TypeVar

from fastapi import APIRouter, HTTPException

from app.analysis.trends import InsufficientDataError
from app.models.schemas import (
    AnalysisRequest,
    CompareRequest,
    CompareResponse,
    CorrelationRequest,
    CorrelationResponse,
    InvestigationResponse,
)
from app.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis Engine"])

T = TypeVar("T")


async def _guard(work: Awaitable[T]) -> T:
    try:
        return await work
    except InsufficientDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected analysis failure")
        raise HTTPException(status_code=500, detail="Internal error while running the analysis.")


@router.post("", response_model=InvestigationResponse)
async def analyze_trend(payload: AnalysisRequest):
    return await _guard(AnalysisService.run_investigation(payload))


@router.post("/compare", response_model=CompareResponse)
async def compare_places(payload: CompareRequest):
    return await _guard(AnalysisService.run_comparison(payload))


@router.post("/correlation", response_model=CorrelationResponse)
async def correlate_variables(payload: CorrelationRequest):
    return await _guard(AnalysisService.run_correlation(payload))
