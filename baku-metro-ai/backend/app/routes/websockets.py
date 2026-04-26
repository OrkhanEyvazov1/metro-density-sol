"""WebSocket endpoints: /ws/admin only.

V3 removed the legacy `/ws/station/{train_id}` endpoint — the station
monitor is now station-fixed (not train-fixed) and consumes the full
SystemState via `/ws/admin`.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from ..state import TrainStateStore, get_store
from ..ws_manager import ConnectionManager, get_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws"])


@router.websocket("/ws/admin")
async def ws_admin(
    websocket: WebSocket,
    manager: Annotated[ConnectionManager, Depends(get_manager)],
    store: Annotated[TrainStateStore, Depends(get_store)],
) -> None:
    await manager.connect_admin(websocket)
    try:
        # Push initial snapshot so the dashboard can render instantly.
        snapshot = await store.snapshot()
        await websocket.send_json(snapshot.model_dump(mode="json"))
        # Keep the connection open. We don't expect messages from admin clients.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.exception("Admin WS error")
    finally:
        await manager.disconnect_admin(websocket)


# NOTE: /ws/station/{train_id} was removed in V3. The station monitor now
# uses /ws/admin and filters trains in the client by `next_station`.
