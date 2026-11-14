from typing import List

from fastapi import APIRouter

from app.models.schemas import DatasetInfo
from app.services.nasa_service import NasaPowerService, latest_complete_year

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.get("", response_model=List[DatasetInfo])
async def list_datasets():
    last = latest_complete_year()
    return [
        DatasetInfo(
            id=ds_id,
            name=meta["name"],
            variable=meta["nasa_variable"],
            unit=meta["unit"],
            spatial_resolution="0.5° x 0.625° (~50 km)",
            temporal_resolution="Monthly",
            start_year=meta["start_year"],
            end_year=last,
            description=f"{meta['name']} from {meta['source']}.",
            limitation=meta["limitation"],
        )
        for ds_id, meta in NasaPowerService.DATASET_MAPPING.items()
    ]
