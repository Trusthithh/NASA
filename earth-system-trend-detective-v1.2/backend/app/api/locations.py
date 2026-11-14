from typing import List

from fastapi import APIRouter, Query

from app.models.schemas import LocationResult
from app.services.geocoding_service import GeocodingService

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/search", response_model=List[LocationResult])
async def search_locations(q: str = Query(..., min_length=2, max_length=100)):
    return await GeocodingService.search_locations(q)
