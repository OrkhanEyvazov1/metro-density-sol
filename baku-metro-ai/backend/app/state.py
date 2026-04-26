"""Thread-safe in-memory state store.

The store is intentionally tiny so it can be replaced later by Redis / a
database without touching call sites — every read/write goes through the
public methods of `TrainStateStore`.
"""
from __future__ import annotations

import asyncio
from collections import deque
from typing import Deque, Dict, List, Optional

from .models import (
    AlertEntry,
    SystemState,
    TrainUpdate,
    utcnow_iso,
)

# Maximum entries kept in memory. Oldest dropped first (FIFO).
ALERT_LOG_MAX = 200
# Maximum train snapshots kept for /api/history.
HISTORY_MAX = 1000
# Number of latest alerts piggy-backed on the SystemState broadcast.
ALERT_LOG_BROADCAST_LIMIT = 50
# Density threshold above which a wagon is considered critical (Red).
RED_THRESHOLD = 75.0


class TrainStateStore:
    """In-memory, asyncio-safe store of the latest density per train."""

    def __init__(self) -> None:
        self._trains: Dict[str, TrainUpdate] = {}
        self._lock = asyncio.Lock()
        self._last_updated: str = utcnow_iso()
        self._alerts: Deque[AlertEntry] = deque(maxlen=ALERT_LOG_MAX)
        self._history: Deque[TrainUpdate] = deque(maxlen=HISTORY_MAX)
        # Trains currently above the threshold — we only log the transition
        # *into* the critical state (Green/Yellow → Red avg) to avoid
        # spamming the log every Phase B step.
        self._critical_trains: set[str] = set()

    async def update_train(self, data: TrainUpdate) -> TrainUpdate:
        """Upsert a train's latest density snapshot.

        The backend stamps the timestamp so generator/camera clock skew
        cannot corrupt ordering. Trains whose average wagon density crosses
        the Red threshold are appended to the alert log (one entry per
        below-threshold → above-threshold transition).
        """
        async with self._lock:
            stamped = data.model_copy(update={"timestamp": utcnow_iso()})
            self._trains[stamped.train_id] = stamped
            self._history.append(stamped)
            self._last_updated = stamped.timestamp
            self._record_alerts(stamped)
            return stamped

    def _record_alerts(self, train: TrainUpdate) -> None:
        """Detect average-density transitions across the Red threshold."""
        if not train.wagons:
            return
        avg_density = sum(w.density for w in train.wagons) / len(train.wagons)
        is_critical = avg_density > RED_THRESHOLD
        was_critical = train.train_id in self._critical_trains
        if is_critical and not was_critical:
            self._critical_trains.add(train.train_id)
            self._alerts.append(
                AlertEntry(
                    timestamp=train.timestamp,
                    train_id=train.train_id,
                    station=train.current_station,
                    overall_density=round(avg_density, 1),
                )
            )
        elif not is_critical and was_critical:
            self._critical_trains.discard(train.train_id)

    async def get_train(self, train_id: str) -> Optional[TrainUpdate]:
        async with self._lock:
            return self._trains.get(train_id)

    async def snapshot(self, alerts_limit: int = ALERT_LOG_BROADCAST_LIMIT) -> SystemState:
        async with self._lock:
            recent_alerts = list(self._alerts)[-alerts_limit:][::-1]
            return SystemState(
                trains=dict(self._trains),
                last_updated=self._last_updated,
                alert_log=recent_alerts,
            )

    async def list_alerts(self, limit: int = ALERT_LOG_MAX) -> List[AlertEntry]:
        """Return up to `limit` most recent alerts, newest first."""
        async with self._lock:
            return list(self._alerts)[-limit:][::-1]

    async def list_history(self, limit: int = HISTORY_MAX) -> List[TrainUpdate]:
        """Return up to `limit` most recent train snapshots, newest first."""
        async with self._lock:
            return list(self._history)[-limit:][::-1]


# Module-level singleton — injected via FastAPI dependency.
_store = TrainStateStore()


def get_store() -> TrainStateStore:
    return _store
