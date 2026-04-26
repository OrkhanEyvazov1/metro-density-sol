# Claude Code Prompt — Baku Metro AI: Passenger Density Real-Time System
# VERSION 3 — INCREMENTAL CHANGES ON TOP OF V2 (Docker project is running)

> **CONTEXT FOR CLAUDE CODE:**
> V2 changes (Login, AlertLog sidebar, StationMonitor route bar, empty seats, Train modal) are already implemented.
> This prompt describes ONLY the new V3 changes to implement on top of V2.
> Do NOT rewrite working files unless a change explicitly touches them.
> Make surgical, minimal edits. Preserve all existing behaviour unless told otherwise.
> After ALL changes are done, run `docker-compose build && docker-compose up` and verify all services are healthy.

---

## 🗺️ STATION LIST (unchanged reference)

```typescript
// src/constants.ts  ← already exists, do not duplicate
export const STATION_LIST = [
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
] as const;

export type StationName = typeof STATION_LIST[number];
```

---

## CHANGE 1 — Station Monitor: Fixed Station View (Not Train Tracker)

### Problem with V2 design
V2 StationMonitor showed a moving train icon tracking ONE train's progress.
This is wrong. A real station monitor is **fixed to a physical station** (e.g. "Elmlər Akademiyası").
It shows ALL trains that are currently approaching THIS station — not one specific train.

### New mental model
```
URL:  /station?name=Elm%C9%99r%20Akademiyas%C4%B1
         ↑ station name in query param (URL-encoded), NOT train_id

The monitor belongs to the STATION, not the train.
It watches for any train whose next_station === this station's name.
```

### What to change

#### `frontend/src/pages/StationMonitor.tsx` — FULL REDESIGN of top section

```
TOP BAR (height ~100px):
  - Left: Station name large, bright white — e.g. "Elmlər Akademiyası"
  - Right: small clock (live HH:MM:SS, updates every second)
  - No train ID. No train number. Nothing else.

INCOMING TRAIN SECTION (below top bar):
  For each train in systemState where train.next_station === THIS_STATION:
    Show a "train arrival card":
    ┌──────────────────────────────────────────────────────┐
    │  ◀ İnşaatçılar          [LOADING BAR]    Elmlər ▶   │
    │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
    │            🚇 (train icon at arrival_progress pos)   │
    └──────────────────────────────────────────────────────┘

  LOADING BAR LOGIC:
  - The loading bar fills left→right based on arrival_progress (0.0→1.0).
  - arrival_progress=0.0 → train just left previous station (bar empty).
  - arrival_progress=1.0 → train has arrived (bar full, then card disappears or dims).
  - Animate with Framer Motion: `scaleX: arrival_progress`, origin left.
  - The 🚇 train icon moves along the track line: x = arrival_progress × line_width.
  - Transition: `{ ease: "linear", duration: 1 }` — smooth 1s interpolation per update.

  BELOW EACH ARRIVAL CARD: wagon density cards (same as V2 — empty seats + bilingual labels).
  
  If NO trains are currently approaching this station:
    Show centered message: "Yaxınlaşan qatar yoxdur" / "No approaching trains"

MULTIPLE TRAINS:
  If 2+ trains have next_station === THIS_STATION simultaneously,
  stack their arrival cards vertically (each with its own wagon density row below).

URL PARAM CHANGE:
  OLD: /station?train=Train-1   (V2 — wrong, do not keep this)
  NEW: /station?name=Elmlər Akademiyası  (station name, URL encoded)
  
  Default if param missing: show first station "Dərnəgül".
```

#### `frontend/src/App.tsx`
- Update StationMonitor route — no change to path, just note the new query param.
- Remove any reference to `?train=` param in StationMonitor.

#### `frontend/src/hooks/useMetroSocket.ts`
- StationMonitor now uses `mode="admin"` (receives full SystemState).
- Filter in the component: `trains.filter(t => t.next_station === stationParam)`.
- Remove `mode="station"` and `/ws/station/{train_id}` — no longer needed.

#### `backend/main.py`
- **REMOVE** the `/ws/station/{train_id}` WebSocket endpoint — it is no longer used.
- Keep `/ws/admin` — StationMonitor now connects here.

---

## CHANGE 2 — Generator: Reduce Smooth Transition Interval to 30 Seconds

### What to change
```python
# generator/generator.py — change ONE constant:

# OLD:
STATION_INTERVAL = 120   # seconds between station arrivals

# NEW:
STATION_INTERVAL = 30    # seconds between station arrivals

# TRANSITION_STEPS and TRANSITION_INTERVAL stay the same:
TRANSITION_STEPS = 10    # 10 steps of smooth density update
TRANSITION_INTERVAL = 1  # 1 second per step → total 10s smooth transition
```

**Result:** Every 30 seconds a Station Arrival fires. The 10-second smooth density transition
happens within those 30 seconds. After the 10-second transition completes, the remaining
20 seconds are idle (no density change, no POST to backend) — the train is "in transit".

---

## CHANGE 3 — Generator: Separate Station Movement from Density Change (Critical Bug Fix)

### Problem (currently broken in V2)
In V2, `arrival_progress` and density change happen AT THE SAME TIME during the 10-step transition.
This means while the train is "moving" between stations (arrival_progress 0→1),
the wagon densities are also changing simultaneously.
This is physically wrong: passengers board/alight ONLY when the train ARRIVES (progress=1.0),
not while it is moving.

### Correct timing model

```
STATION_INTERVAL = 30 seconds, broken into 3 distinct phases:

PHASE A — TRANSIT (0s to 10s):
  - arrival_progress goes from 0.0 → 1.0 in 10 steps × 1s = 10 seconds.
  - Wagon densities DO NOT CHANGE during this phase.
  - POST TrainUpdate every second with updated arrival_progress only (densities unchanged).

PHASE B — DWELL / BOARDING (10s to 20s):
  - arrival_progress is fixed at 1.0 (train is at station).
  - Passenger boarding/alighting: wagon densities change smoothly over 10 steps × 1s.
  - POST TrainUpdate every second with updated densities (arrival_progress stays 1.0).
  - New target densities are generated at start of Phase B (random 0–100 per wagon).

PHASE C — IDLE (20s to 30s):
  - No POSTs to backend.
  - Train is paused at station (doors closed, preparing to depart).
  - Frontend shows: arrival_progress=1.0, densities stable.

AT 30s MARK (new cycle starts):
  - current_station = old next_station
  - next_station = next in STATION_LIST (advance index, reverse at ends)
  - arrival_progress resets to 0.0
  - PHASE A begins again for next journey segment.
```

### Implementation

```python
# generator/generator.py — replace the station loop with this structure:

async def run_train(train_id: str, initial_offset: float):
    await asyncio.sleep(initial_offset)

    # Initialize train state
    state = TrainState(
        train_id=train_id,
        station_index=random.randint(0, len(STATION_LIST) - 2),
        direction=1,  # 1=forward, -1=reverse
        densities=[random.uniform(10, 90) for _ in range(WAGONS_PER_TRAIN)],
    )

    # POST initial state
    await post_update(state, arrival_progress=1.0)

    while True:
        current_station = STATION_LIST[state.station_index]
        next_index = state.station_index + state.direction
        # Reverse direction at ends
        if next_index < 0 or next_index >= len(STATION_LIST):
            state.direction *= -1
            next_index = state.station_index + state.direction
        next_station = STATION_LIST[next_index]

        # ── PHASE A: TRANSIT (10s) ──────────────────────────────────
        for step in range(TRANSITION_STEPS):
            progress = (step + 1) / TRANSITION_STEPS   # 0.1 → 1.0
            await post_update(
                state,
                arrival_progress=progress,
                current_station=current_station,
                next_station=next_station,
                # densities UNCHANGED
            )
            await asyncio.sleep(TRANSITION_INTERVAL)

        # ── PHASE B: BOARDING/ALIGHTING (10s) ───────────────────────
        old_densities = state.densities[:]
        target_densities = [random.uniform(0, 100) for _ in range(WAGONS_PER_TRAIN)]

        for step in range(TRANSITION_STEPS):
            t = (step + 1) / TRANSITION_STEPS
            state.densities = [
                old_densities[i] + t * (target_densities[i] - old_densities[i])
                for i in range(WAGONS_PER_TRAIN)
            ]
            await post_update(
                state,
                arrival_progress=1.0,
                current_station=current_station,
                next_station=next_station,
            )
            await asyncio.sleep(TRANSITION_INTERVAL)

        # ── PHASE C: IDLE (10s) ──────────────────────────────────────
        await asyncio.sleep(STATION_INTERVAL - 2 * TRANSITION_STEPS * TRANSITION_INTERVAL)
        # = 30 - 20 = 10 seconds idle

        # Advance station
        state.station_index = next_index

# helper:
async def post_update(state, arrival_progress, current_station=None, next_station=None):
    wagons = [
        {
            "wagon_id": i + 1,
            "density": round(state.densities[i], 1),
            "status": density_to_status(state.densities[i]),
        }
        for i in range(WAGONS_PER_TRAIN)
    ]
    payload = {
        "train_id": state.train_id,
        "current_station": current_station or STATION_LIST[state.station_index],
        "next_station": next_station or STATION_LIST[state.station_index],
        "arrival_progress": round(arrival_progress, 3),
        "wagons": wagons,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(BACKEND_URL, json=payload)
    except httpx.RequestError as e:
        print(f"[Generator] POST failed for {state.train_id}: {e}")
```

---

## CHANGE 4 — Alert Log: Separate Page + Updated Columns

### What to change

#### 4a — New route `/admin/alerts` (separate page)

- **CREATE** `frontend/src/pages/AlertLogPage.tsx`
- **MODIFY** `frontend/src/App.tsx` — add protected route `/admin/alerts`

```
AlertLogPage.tsx LAYOUT:
- Same dark theme as AdminDashboard
- Header: "← Admin Panelə Qayıt" (back button → /admin) + "🚨 Kritik Vəziyyətlər Loqu" title
- Full-width table (NOT a sidebar)
- Pagination: 20 rows per page, "Əvvəlki / Növbəti" buttons
- "Loqu Yenilə" button → re-fetch GET /api/alerts
- "Loqu Təmizlə" → clears local display
- If empty: "Kritik hadisə qeyd edilməyib"
```

#### 4b — Updated alert columns (REPLACE V2 columns)

```
OLD V2 columns: Tarix/Saat | Qatar ID | Vaqon No | Sıxlıq (%) | Status
NEW V3 columns: Tarix/Saat | Qatar ID | Stansiya  | Ümumi Sıxlıq (%) | Status

Column details:
  Tarix/Saat         → "HH:MM:SS  DD.MM.YYYY" (local time, monospace)
  Qatar ID           → "Train-3"
  Stansiya           → current_station at time of alert (e.g. "Nizami")
  Ümumi Sıxlıq (%)  → average density of ALL 5 wagons at that moment (e.g. "78.4%", red bold)
  Status             → red badge "KRİTİK"
```

#### 4c — AlertEntry backend model update

```python
# backend/models.py — update AlertEntry:
class AlertEntry(BaseModel):
    timestamp: str          # ISO 8601
    train_id: str
    station: str            # current_station at time of alert (NEW — replaces wagon_id)
    overall_density: float  # average of all wagon densities at alert time (NEW)
    status: str = "Red"
```

#### 4d — Backend state.py alert logic update

```python
# backend/state.py — update_train() alert logic:
# OLD: append one AlertEntry per RED wagon
# NEW: append ONE AlertEntry per TrainUpdate IF average density > 75%

def update_train(data: TrainUpdate) -> None:
    # ... existing upsert logic ...
    avg_density = sum(w.density for w in data.wagons) / len(data.wagons)
    if avg_density > 75.0:
        entry = AlertEntry(
            timestamp=data.timestamp,
            train_id=data.train_id,
            station=data.current_station,
            overall_density=round(avg_density, 1),
        )
        alert_log.append(entry)
        if len(alert_log) > 200:
            alert_log.pop(0)
```

#### 4e — Admin Dashboard: replace AlertLog sidebar with a button

```
MODIFY frontend/src/pages/AdminDashboard.tsx:
- REMOVE the 380px AlertLog sidebar (from V2).
- REMOVE the AlertLog component import.
- ADD in the header area: a red button "🚨 Kritik Loq" → navigate("/admin/alerts")
- Revert AdminDashboard layout to full-width train grid (no sidebar split).
```

#### 4f — AlertLog.tsx (V2 component)
- Keep the file but it is now only used inside AlertLogPage.tsx, not as a sidebar.
- Update its column headers and data mapping to match the new V3 schema.

---

## CHANGE 5 — Code Quality: Safe Code & Clean Code Principles

Apply these standards across ALL files touched in V2 and V3 (not just new files).

### 5a — TypeScript strict safety

```typescript
// tsconfig.json — ensure these are set:
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}

// Rules:
// - No `any` types anywhere. Use `unknown` + type guards if needed.
// - All optional chaining: `data?.trains?.[id]` not `data.trains[id]`
// - Nullish coalescing: `value ?? defaultValue` not `value || defaultValue`
// - Explicit return types on all exported functions and hooks.
// - No non-null assertions (`!`) — use proper guards instead.
```

### 5b — Constants file (single source of truth)

```typescript
// src/constants.ts — ALL magic values live here, nowhere else:
export const STATION_LIST = [...] as const;
export const TOTAL_SEATS_PER_WAGON = 40;
export const DENSITY_THRESHOLDS = { GREEN: 40, YELLOW: 75 } as const;
export const WS_RECONNECT_MAX_DELAY_MS = 5000;
export const ALERT_PAGE_SIZE = 20;
export const ADMIN_CREDENTIALS = { username: "admin", password: "metro2025" } as const;
```

### 5c — Custom hooks — one responsibility each

```typescript
// Each hook does ONE thing:
// useMetroSocket.ts     → WebSocket connection + reconnect logic only
// useAlerts.ts          → fetch + store alert log, expose clearAlerts()
// useStationFilter.ts   → filter trains by next_station from systemState
// useAuth.ts            → read/write sessionStorage auth token

// No hook should contain JSX.
// No component should contain fetch/WebSocket logic directly — always use a hook.
```

### 5d — Component rules

```
- Max component file length: 150 lines. If longer → extract sub-components.
- Each component has ONE clearly named responsibility.
- Props interfaces defined above the component with JSDoc comments.
- No inline styles — Tailwind classes only.
- No magic numbers in JSX — use constants.
- Framer Motion variants defined as named const above component, not inline.
```

### 5e — Error boundaries

```typescript
// CREATE frontend/src/components/ErrorBoundary.tsx
// Wrap AdminDashboard, StationMonitor, AlertLogPage each in <ErrorBoundary>
// On error: show "Xəta baş verdi. Yenidən cəhd edin." with a reload button.
// Log error to console.error (no external service).
```

### 5f — Generator: safe async Python

```python
# generator/generator.py rules:
# - All HTTP calls wrapped in try/except httpx.RequestError
# - Use dataclass for TrainState (not a plain dict):

from dataclasses import dataclass, field

@dataclass
class TrainState:
    train_id: str
    station_index: int
    direction: int
    densities: list[float] = field(default_factory=list)

# - density_to_status() is a pure function, defined once at module level
# - STATION_LIST, BACKEND_URL, all config as module-level constants (UPPER_SNAKE_CASE)
# - No bare `except:` — always catch specific exceptions
```

### 5g — Backend: clean FastAPI

```python
# backend rules:
# - Separate routers: routers/density.py, routers/websocket.py, routers/alerts.py
#   imported into main.py via app.include_router()
# - state.py exports ONLY functions (get_all_trains, update_train, get_alerts)
#   — the internal dicts are module-private (prefixed with _)
# - All endpoint functions have type annotations on params and return type
# - Use HTTPException with meaningful detail strings, not bare raise
# - Lifespan context manager for startup/shutdown (not deprecated @app.on_event)
```

---

## 📁 V3 FILE CHANGES SUMMARY

```
frontend/src/
├── constants.ts                  ← MODIFIED (add new constants)
├── contexts/
│   └── AuthContext.tsx           ← unchanged (V2)
├── pages/
│   ├── LoginPage.tsx             ← unchanged (V2)
│   ├── AdminDashboard.tsx        ← MODIFIED (remove sidebar, add alert button, full-width grid)
│   ├── StationMonitor.tsx        ← MODIFIED (station-fixed view, filter by next_station)
│   └── AlertLogPage.tsx          ← NEW (full page alert log)
├── components/
│   ├── AlertLog.tsx              ← MODIFIED (new columns: Stansiya, Ümumi Sıxlıq)
│   ├── ErrorBoundary.tsx         ← NEW (Change 5e)
│   ├── TrainDetailModal.tsx      ← unchanged (V2) — apply code quality rules
│   ├── TrainSilhouette.tsx       ← unchanged (V2) — apply code quality rules
│   └── WagonCard.tsx             ← unchanged (V2) — apply code quality rules
├── hooks/
│   ├── useMetroSocket.ts         ← MODIFIED (remove station mode, add useStationFilter)
│   ├── useAlerts.ts              ← NEW
│   ├── useStationFilter.ts       ← NEW
│   └── useAuth.ts                ← NEW
└── App.tsx                       ← MODIFIED (add /admin/alerts route)

backend/
├── models.py                     ← MODIFIED (AlertEntry: station + overall_density)
├── state.py                      ← MODIFIED (alert logic: avg > 75, not per-wagon)
├── main.py                       ← MODIFIED (remove /ws/station, add routers)
└── routers/
    ├── density.py                ← NEW (extracted from main.py)
    ├── websocket.py              ← NEW (extracted from main.py)
    └── alerts.py                 ← NEW (extracted from main.py)

generator/
└── generator.py                  ← MODIFIED (3-phase loop, dataclass state, 30s interval)
```

---

## 🚀 IMPLEMENTATION ORDER

1. **`backend/models.py`** — update AlertEntry fields
2. **`backend/state.py`** — update alert logic (avg density, not per-wagon)
3. **`backend/routers/`** — extract density, websocket, alerts routers; update main.py
4. **`generator/generator.py`** — 3-phase loop (Transit / Boarding / Idle), dataclass, 30s interval
5. **`frontend/src/constants.ts`** — add all new constants
6. **`frontend/src/hooks/useAlerts.ts`** — new hook
7. **`frontend/src/hooks/useStationFilter.ts`** — new hook
8. **`frontend/src/hooks/useAuth.ts`** — new hook
9. **`frontend/src/hooks/useMetroSocket.ts`** — remove station mode
10. **`frontend/src/pages/StationMonitor.tsx`** — full station-fixed redesign
11. **`frontend/src/pages/AlertLogPage.tsx`** — new full-page alert log
12. **`frontend/src/pages/AdminDashboard.tsx`** — remove sidebar, add alert button
13. **`frontend/src/components/AlertLog.tsx`** — update columns
14. **`frontend/src/components/ErrorBoundary.tsx`** — new error boundary
15. **`frontend/src/App.tsx`** — add `/admin/alerts` route
16. **Apply code quality rules** (Change 5) to ALL touched files
17. **`docker-compose build && docker-compose up`** — verify all 3 services start

---

## ✅ V3 ACCEPTANCE CRITERIA

### Station Monitor
- [ ] URL is `/station?name=Elmlər Akademiyası` (station name param, not train)
- [ ] Page title shows the station name, nothing else (no train ID/number)
- [ ] Shows only trains where `next_station === query param station`
- [ ] Each approaching train has a loading bar (fills left→right by arrival_progress)
- [ ] 🚇 train icon moves along the track line as arrival_progress increases
- [ ] Loading bar does NOT change during density updates (Phase B) — only during transit (Phase A)
- [ ] If no trains approaching: shows "Yaxınlaşan qatar yoxdur"
- [ ] Multiple approaching trains stacked vertically if they exist

### Generator timing
- [ ] Station cycle is 30 seconds total
- [ ] Phase A (transit): 10s — arrival_progress 0→1, densities UNCHANGED
- [ ] Phase B (boarding): 10s — densities change smoothly, arrival_progress fixed at 1.0
- [ ] Phase C (idle): 10s — no POST to backend, train stationary
- [ ] Trains staggered: Train-N starts with N×3s offset (30s / 10 trains = 3s apart)

### Alert Log
- [ ] Alert log is accessible at `/admin/alerts` (separate page, protected)
- [ ] "🚨 Kritik Loq" button in Admin Dashboard header links to `/admin/alerts`
- [ ] NO sidebar in Admin Dashboard (full-width train grid restored)
- [ ] Alert columns: Tarix/Saat | Qatar ID | Stansiya | Ümumi Sıxlıq (%) | Status
- [ ] Alert triggers when AVERAGE wagon density > 75% (not individual wagon)
- [ ] Pagination: 20 rows per page
- [ ] "← Admin Panelə Qayıt" back button works

### Code quality
- [ ] No `any` types in TypeScript (`tsc --noEmit --strict` passes)
- [ ] All magic numbers in `constants.ts` only
- [ ] Each hook has single responsibility + explicit return type
- [ ] No component file exceeds 150 lines
- [ ] ErrorBoundary wraps all 3 main pages
- [ ] Generator uses `TrainState` dataclass
- [ ] Backend uses router structure (`routers/` directory)
- [ ] No bare `except:` in Python — always specific exception types

### General
- [ ] `docker-compose build` succeeds with no errors
- [ ] All 3 services (backend, frontend, generator) healthy after `docker-compose up`
- [ ] `/ws/station/{train_id}` endpoint is REMOVED from backend
- [ ] `/station` without `?name=` param defaults to first station ("Dərnəgül")

---

## 📝 FINAL NOTES FOR CLAUDE CODE

- **Station Monitor is station-fixed, not train-fixed.** This is the fundamental change from V2.
  The component receives a station name, watches ALL trains, and shows only those approaching IT.
- **The 3-phase generator loop is the most critical correctness fix.**
  arrival_progress and density must NEVER change in the same time window.
- **AlertEntry now represents a train-level event** (avg > 75%), not a wagon-level event.
  One POST → at most one AlertEntry (if avg density crossed threshold).
- **Do not re-introduce the `/ws/station/{train_id}` endpoint.** StationMonitor now uses `/ws/admin`.
- **Apply Clean Code to every file you touch**, even if the file was from V2 and "works".
  V3 is a quality pass, not just a feature pass.
