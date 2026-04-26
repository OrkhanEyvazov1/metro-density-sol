"""WebSocket connection manager.

Maintains two distinct rooms:
  * admin clients   → receive full `SystemState` on every update
  * station clients → keyed by train_id, receive only their train's wagons

Single Responsibility: this class only owns connection bookkeeping and
fan-out. Domain logic lives in `state.py` and `routes/`.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._admins: Set[WebSocket] = set()
        self._stations: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    # ---------- admin room ----------
    async def connect_admin(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._admins.add(ws)
        logger.info("Admin WS connected (%d active)", len(self._admins))

    async def disconnect_admin(self, ws: WebSocket) -> None:
        async with self._lock:
            self._admins.discard(ws)
        logger.info("Admin WS disconnected (%d active)", len(self._admins))

    # ---------- station rooms ----------
    async def connect_station(self, train_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._stations.setdefault(train_id, set()).add(ws)
        logger.info("Station WS connected for %s", train_id)

    async def disconnect_station(self, train_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._stations.get(train_id)
            if room:
                room.discard(ws)
                if not room:
                    self._stations.pop(train_id, None)
        logger.info("Station WS disconnected for %s", train_id)

    # ---------- broadcast ----------
    async def broadcast_admin(self, payload: Dict[str, Any]) -> None:
        await self._broadcast(self._snapshot_admins(), payload)

    async def broadcast_station(self, train_id: str, payload: Dict[str, Any]) -> None:
        await self._broadcast(self._snapshot_station(train_id), payload)

    def _snapshot_admins(self) -> Set[WebSocket]:
        # snapshot copy so we can iterate without holding the lock
        return set(self._admins)

    def _snapshot_station(self, train_id: str) -> Set[WebSocket]:
        return set(self._stations.get(train_id, ()))

    async def _broadcast(self, sockets: Set[WebSocket], payload: Dict[str, Any]) -> None:
        if not sockets:
            return
        dead: list[WebSocket] = []
        results = await asyncio.gather(
            *(self._safe_send(ws, payload) for ws in sockets),
            return_exceptions=True,
        )
        for ws, ok in zip(sockets, results):
            if ok is False or isinstance(ok, Exception):
                dead.append(ws)
        if dead:
            async with self._lock:
                self._admins.difference_update(dead)
                for room in self._stations.values():
                    room.difference_update(dead)

    @staticmethod
    async def _safe_send(ws: WebSocket, payload: Dict[str, Any]) -> bool:
        try:
            await ws.send_json(payload)
            return True
        except Exception as exc:  # noqa: BLE001 — defensive net for any WS error
            logger.debug("WS send failed, will drop client: %s", exc)
            return False


_manager = ConnectionManager()


def get_manager() -> ConnectionManager:
    return _manager
