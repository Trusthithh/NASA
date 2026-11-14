import logging

from fastapi import APIRouter, HTTPException

from app.analysis.trends import InsufficientDataError
from app.models.schemas import AnalysisRequest, InvestigationResponse
from app.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis Engine"])


@router.post("", response_model=InvestigationResponse)
async def analyze_trend(payload: AnalysisRequest):
    try:
        return await AnalysisService.run_investigation(payload)
    except InsufficientDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected analysis failure")
        raise HTTPException(status_code=500, detail="Internal error while running the analysis.")
