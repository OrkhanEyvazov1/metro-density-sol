"""Mock passenger-density generator for Baku Metro AI.

Each of NUM_TRAINS trains runs as an independent asyncio task. Every
STATION_INTERVAL seconds the train "arrives" at a station: a fresh target
density per wagon is sampled and the current density is interpolated
toward it over TRANSITION_STEPS * TRANSITION_INTERVAL seconds, POSTing
each step to the backend.

This file is the ONLY mock-data layer in the system. Replacing it with
real AI cameras requires no other change — cameras must POST identical
`TrainUpdate` JSON to BACKEND_URL.
"""
from __future__ import annotations

import asyncio
import logging
import random
import signal
from dataclasses import dataclass
from typing import Dict, List

import httpx

from generator.config import CONFIG

# Station list — must mirror backend `app.models.STATION_LIST`.
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


@dataclass
class RouteState:
    """Tracks a single train's position along STATION_LIST.

    V3.2: the route is *circular* — Nəriman Nərimanov → Dərnəgül wraps via
    modulo, no reversal at endpoints. `current_idx` is the station the
    train just departed from; `next_idx` is where it is heading.
    """

    current_idx: int

    @property
    def next_idx(self) -> int:
        return (self.current_idx + 1) % len(STATION_LIST)

    def advance(self) -> None:
        """Step to the next segment of the circle."""
        self.current_idx = self.next_idx

    @property
    def current_station(self) -> str:
        return STATION_LIST[self.current_idx]

    @property
    def next_station(self) -> str:
        return STATION_LIST[self.next_idx]


def _initial_route_state(train_index: int) -> RouteState:
    """Place each train on its own segment of the circular route.

    V3.3: NUM_STATIONS=11 segments, NUM_TRAINS=11 — every segment is
    occupied at startup. Train-N starts at segment N%11; the loop's 45s
    cadence keeps trains exactly one segment apart forever.
    """
    return RouteState(current_idx=train_index % len(STATION_LIST))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | generator | %(message)s",
)
logger = logging.getLogger("generator")

GREEN_MAX = 40.0
YELLOW_MAX = 75.0


def classify(density: float) -> str:
    if density < GREEN_MAX:
        return "Green"
    if density <= YELLOW_MAX:
        return "Yellow"
    return "Red"


def build_payload(
    train_id: str,
    densities: List[float],
    route: RouteState,
    arrival_progress: float,
) -> Dict:
    """Construct a TrainUpdate-compatible JSON payload."""
    return {
        "train_id": train_id,
        "wagons": [
            {
                "wagon_id": idx + 1,
                "density": round(d, 2),
                "status": classify(d),
            }
            for idx, d in enumerate(densities)
        ],
        "current_station": route.current_station,
        "next_station": route.next_station,
        "arrival_progress": round(max(0.0, min(1.0, arrival_progress)), 3),
    }


async def post_with_retry(
    client: httpx.AsyncClient,
    payload: Dict,
    *,
    max_attempts: int = 3,
) -> None:
    """POST a snapshot, retrying transient failures with exponential backoff."""
    delay = 0.5
    for attempt in range(1, max_attempts + 1):
        try:
            resp = await client.post(CONFIG.backend_url, json=payload)
            resp.raise_for_status()
            return
        except (httpx.HTTPError, httpx.TransportError) as exc:
            if attempt == max_attempts:
                logger.warning(
                    "Failed POST for %s after %d attempts: %s",
                    payload.get("train_id"),
                    attempt,
                    exc,
                )
                return
            await asyncio.sleep(delay)
            delay *= 2


async def wait_for_backend(client: httpx.AsyncClient) -> None:
    """Block until backend health check responds (or give up after 60s)."""
    health_url = CONFIG.backend_url.rsplit("/api/", 1)[0] + "/api/health"
    deadline = asyncio.get_event_loop().time() + 60
    while asyncio.get_event_loop().time() < deadline:
        try:
            r = await client.get(health_url, timeout=2.0)
            if r.status_code == 200:
                logger.info("Backend reachable at %s", health_url)
                return
        except httpx.HTTPError:
            pass
        await asyncio.sleep(1.0)
    logger.warning("Backend health check timed out — proceeding anyway")


def random_density() -> float:
    return round(random.uniform(0.0, 100.0), 2)


async def train_loop(
    client: httpx.AsyncClient,
    train_id: str,
    train_index: int,
    stagger: float,
) -> None:
    """Drive a single train's lifecycle forever using the V3.2 3-phase model.

    Each station cycle (`station_interval_s`, default 45s) is split into:

      Phase A — Transit (30s, `transition_steps` ticks × 1s):
        arrival_progress 0.0 → 1.0.
        Wagon densities are FROZEN — passengers do not board mid-tunnel.

      Phase B — Boarding/alighting (10s, `boarding_steps` ticks × 1s):
        arrival_progress is pinned at 1.0 (train at platform).
        Wagon densities interpolate from old → fresh random target.

      Phase C — Idle (5s, `idle_seconds`):
        No POSTs. Train waits at platform with doors closed before
        departing. Frontend keeps last received state.

    Route is circular — advance() is a simple modulo wrap.
    """
    # V3.4: no stagger — all trains start simultaneously from their
    # assigned segments and begin Phase A at the same instant.
    del stagger
    route = _initial_route_state(train_index)
    densities: List[float] = [
        random.uniform(10.0, 90.0) for _ in range(CONFIG.wagons_per_train)
    ]

    # POST initial state (arrival_progress=0.0) BEFORE the loop so the
    # monitor is never blank on first paint, even before this train's
    # first Phase A tick fires.
    await post_with_retry(
        client, build_payload(train_id, densities, route, arrival_progress=0.0)
    )
    logger.info(
        "[%s] online at %s → %s", train_id, route.current_station, route.next_station
    )

    transit_steps = max(1, CONFIG.transition_steps)
    boarding_steps = max(1, CONFIG.boarding_steps)
    idle_seconds = max(0.0, CONFIG.idle_seconds)
    step_dt = max(0.0, CONFIG.transition_interval_s)

    while True:
        try:
            # ---------------- PHASE A: TRANSIT (30s) ----------------
            for step in range(1, transit_steps + 1):
                ratio = step / transit_steps  # 1/30 … 1.0
                await post_with_retry(
                    client,
                    build_payload(train_id, densities, route, arrival_progress=ratio),
                )
                await asyncio.sleep(step_dt)

            # ---------------- PHASE B: BOARDING/ALIGHTING (10s) ----------------
            old_densities = list(densities)
            target = [random_density() for _ in range(CONFIG.wagons_per_train)]
            logger.info(
                "[%s] arrived %s; boarding target densities %s",
                train_id,
                route.next_station,
                [round(t, 1) for t in target],
            )
            for step in range(1, boarding_steps + 1):
                t = step / boarding_steps
                densities = [
                    old_densities[i] + t * (target[i] - old_densities[i])
                    for i in range(CONFIG.wagons_per_train)
                ]
                await post_with_retry(
                    client,
                    build_payload(train_id, densities, route, arrival_progress=1.0),
                )
                await asyncio.sleep(step_dt)
            densities = target

            # ---------------- PHASE C: IDLE (5s) ----------------
            # No POSTs — train waits silently before departing.
            if idle_seconds > 0:
                await asyncio.sleep(idle_seconds)

            # Circular advance: current ← next, next wraps via modulo.
            route.advance()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — never let a single train kill the loop
            logger.exception("[%s] unexpected error, continuing", train_id)
            await asyncio.sleep(1.0)


async def main() -> None:
    if CONFIG.startup_delay_s > 0:
        logger.info("Sleeping %.1fs before startup", CONFIG.startup_delay_s)
        await asyncio.sleep(CONFIG.startup_delay_s)

    timeout = httpx.Timeout(CONFIG.request_timeout_s)
    async with httpx.AsyncClient(timeout=timeout) as client:
        await wait_for_backend(client)

        tasks = [
            asyncio.create_task(
                train_loop(
                    client,
                    train_id=f"Train-{i + 1}",
                    train_index=i,
                    stagger=(i * CONFIG.train_stagger_s),
                ),
                name=f"Train-{i + 1}",
            )
            for i in range(CONFIG.num_trains)
        ]

        # Graceful shutdown on SIGTERM/SIGINT.
        loop = asyncio.get_event_loop()
        stop_event = asyncio.Event()

        def _handle_stop() -> None:
            logger.info("Shutdown signal received")
            stop_event.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, _handle_stop)
            except NotImplementedError:
                # Windows / restricted env — ignore.
                pass

        await stop_event.wait()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
