"""REST routes for the critical-event alert log.

Extracted from `density.py` in V3 to keep one router per concern.
"""
from __future__ import annotations

from typing import Annotated, List

from fastapi import APIRouter, Depends

from ..models import AlertEntry
from ..state import TrainStateStore, get_store

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get(
    "/alerts",
    response_model=List[AlertEntry],
    summary="Recent critical train events (avg density > 75%), newest first",
)
async def list_alerts(
    store: Annotated[TrainStateStore, Depends(get_store)],
) -> List[AlertEntry]:
    return await store.list_alerts()
