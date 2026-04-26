"""Pydantic v2 domain models for the Baku Metro AI passenger density system.

These models are the single source of truth for the wire-format that:
  - The generator (mock data) POSTs to /api/density
  - Real AI camera ingestors will POST to /api/density (drop-in replacement)
  - Frontend WebSocket clients consume

Keep TypeScript types in `frontend/src/types/metro.ts` aligned with these.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WagonStatus(str, Enum):
    """Discrete density status used for colour coding on the UI."""

    GREEN = "Green"
    YELLOW = "Yellow"
    RED = "Red"


# Density thresholds — single source of truth. Generator and frontend mirror these.
GREEN_MAX = 40.0
YELLOW_MAX = 75.0


def classify_density(density: float) -> WagonStatus:
    """Map a density percentage to a `WagonStatus`."""
    if density < GREEN_MAX:
        return WagonStatus.GREEN
    if density <= YELLOW_MAX:
        return WagonStatus.YELLOW
    return WagonStatus.RED


def utcnow_iso() -> str:
    """ISO-8601 UTC timestamp (millisecond precision)."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class WagonData(BaseModel):
    """Density reading for a single wagon."""

    model_config = ConfigDict(extra="forbid")

    wagon_id: int = Field(..., ge=1, le=20, description="1-based wagon index")
    density: float = Field(..., ge=0.0, le=100.0, description="Occupancy %")
    status: WagonStatus = Field(..., description="Discrete density status")

    @field_validator("density")
    @classmethod
    def _round_density(cls, value: float) -> float:
        return round(value, 2)


# Baku Metro station list — kept here so generator/backend share a single
# source of truth. Frontend mirrors this in `src/constants.ts`.
STATION_LIST: List[str] = [
    "Dərnəgül",
    "Azadlıq prospekti",
    "Nəsimi",
    "Memar Əcəmi",
    "20 Yanvar",
    "İnşaatçılar",
    "Elmlər Akademiyası",
    "Nizami",
    "28 May",
    "Gənclik",
    "Nəriman Nərimanov",
]


class TrainUpdate(BaseModel):
    """Density payload for an entire train (one snapshot)."""

    # Allow extra ignored to make the field additions backward compatible if a
    # legacy client posts older JSON. Server still validates declared fields.
    model_config = ConfigDict(extra="ignore")

    train_id: str = Field(..., min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_\-]+$")
    wagons: List[WagonData] = Field(..., min_length=1, max_length=20)
    timestamp: str = Field(default_factory=utcnow_iso)

    # --- Route progress (v2) ----------------------------------------------
    current_station: str = Field(default=STATION_LIST[0])
    next_station: str = Field(default=STATION_LIST[1])
    arrival_progress: float = Field(default=0.0, ge=0.0, le=1.0)

    @field_validator("wagons")
    @classmethod
    def _unique_wagon_ids(cls, value: List[WagonData]) -> List[WagonData]:
        ids = [w.wagon_id for w in value]
        if len(set(ids)) != len(ids):
            raise ValueError("wagon_id values must be unique within a train")
        return sorted(value, key=lambda w: w.wagon_id)


class AlertEntry(BaseModel):
    """A train-level critical event (average density across all wagons > 75%).

    V3 schema change: V2 represented one entry per Red *wagon*; V3 represents
    one entry per *train update* whose mean density crossed the threshold.
    """

    model_config = ConfigDict(extra="forbid")

    timestamp: str = Field(default_factory=utcnow_iso)
    train_id: str
    station: str = Field(..., description="current_station at time of alert")
    overall_density: float = Field(..., ge=0.0, le=100.0)
    status: WagonStatus = WagonStatus.RED


class SystemState(BaseModel):
    """Full snapshot of every known train — broadcast to admin clients."""

    model_config = ConfigDict(extra="forbid")

    trains: Dict[str, TrainUpdate]
    last_updated: str = Field(default_factory=utcnow_iso)
    # Last 50 critical (Red) events. Sent over /ws/admin so the dashboard does
    # not need a second HTTP call after the initial mount.
    alert_log: List[AlertEntry] = Field(default_factory=list)


class DensityAck(BaseModel):
    """Response body for POST /api/density."""

    status: str = "ok"
    train_id: str
