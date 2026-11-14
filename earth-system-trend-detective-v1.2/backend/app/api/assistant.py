import logging

from fastapi import APIRouter, HTTPException

from app.analysis.trends import InsufficientDataError
from app.models.schemas import AssistantRequest, AssistantResponse
from app.services.ai_service import AiResearchAssistant
from app.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


@router.post("/explain", response_model=AssistantResponse)
async def explain_findings(payload: AssistantRequest):
    """The investigation is recomputed server-side (cached), so the client cannot
    supply or alter the statistics the assistant is grounded on."""
    try:
        investigation = await AnalysisService.run_investigation(payload.analysis)
    except InsufficientDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected assistant failure")
        raise HTTPException(status_code=500, detail="Internal error while preparing the answer.")

    answer, source = await AiResearchAssistant.generate_explanation(
        payload.question, investigation
    )
    return AssistantResponse(
        answer=answer,
        sources_cited=[source],
        confidence_note="Grounded in statistics computed by the backend from NASA POWER data.",
    )
