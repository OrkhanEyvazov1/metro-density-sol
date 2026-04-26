"""Generator runtime configuration (env-overridable)."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class GeneratorConfig:
    backend_url: str = os.getenv("BACKEND_URL", "http://localhost:8000/api/density")
    num_trains: int = _env_int("NUM_TRAINS", 11)
    wagons_per_train: int = _env_int("WAGONS_PER_TRAIN", 5)
    # V3.2: full station cycle is 45s = 30s Transit + 10s Boarding + 5s Idle.
    # Circular route — no reversal at endpoints. See `generator.train_loop`.
    station_interval_s: float = _env_float("STATION_INTERVAL", 45.0)
    # Phase A — Transit: arrival_progress 0 → 1 over 30 ticks × 1s.
    transition_steps: int = _env_int("TRANSITION_STEPS", 30)
    transition_interval_s: float = _env_float("TRANSITION_INTERVAL", 1.0)
    # Phase B — Boarding/alighting: density interpolation over 10 ticks × 1s.
    boarding_steps: int = _env_int("BOARDING_STEPS", 10)
    # Phase C — Idle: no POSTs, train waits at platform.
    idle_seconds: float = _env_float("IDLE_SECONDS", 5.0)
    # V3.3: 45s / 11 trains ≈ 4.09s offset — every segment occupied, no buffer.
    train_stagger_s: float = _env_float("TRAIN_STAGGER", 45.0 / 11.0)
    request_timeout_s: float = _env_float("REQUEST_TIMEOUT", 5.0)
    startup_delay_s: float = _env_float("STARTUP_DELAY", 3.0)


CONFIG = GeneratorConfig()
