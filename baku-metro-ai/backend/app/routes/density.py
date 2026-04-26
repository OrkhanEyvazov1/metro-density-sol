"""REST routes for density ingestion and snapshot retrieval."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..models import DensityAck, SystemState, TrainUpdate
from ..state import TrainStateStore, get_store
from ..ws_manager import ConnectionManager, get_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["density"])


@router.post(
    "/density",
    response_model=DensityAck,
    status_code=status.HTTP_200_OK,
    summary="Ingest a train density snapshot",
)
async def ingest_density(
    payload: TrainUpdate,
    store: Annotated[TrainStateStore, Depends(get_store)],
    manager: Annotated[ConnectionManager, Depends(get_manager)],
) -> DensityAck:
    """Accept a density snapshot from the (mock) generator or a real camera.

    Replacing the mock generator with real AI cameras requires no code
    change here — cameras only need to POST the same `TrainUpdate` JSON.
    """
    try:
        stored = await store.update_train(payload)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to update train state")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="state_update_failed",
        ) from exc

    snapshot = await store.snapshot()
    # V3: only the admin/system stream is broadcast; the per-train station
    # subscription was removed because the station monitor is now
    # station-fixed and filters from the SystemState client-side.
    await manager.broadcast_admin(snapshot.model_dump(mode="json"))
    return DensityAck(train_id=stored.train_id)


@router.get(
    "/state",
    response_model=SystemState,
    summary="Full snapshot of all trains (used by frontends on initial load)",
)
async def get_state(
    store: Annotated[TrainStateStore, Depends(get_store)],
) -> SystemState:
    return await store.snapshot()


@router.get(
    "/history",
    response_model=list[TrainUpdate],
    summary="Recent train snapshots (newest first)",
)
async def get_history(
    store: Annotated[TrainStateStore, Depends(get_store)],
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[TrainUpdate]:
    return await store.list_history(limit=limit)


@router.get("/health", summary="Liveness probe", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
