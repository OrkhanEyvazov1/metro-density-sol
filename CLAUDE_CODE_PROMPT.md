# Claude Code Prompt — Baku Metro AI: Passenger Density Real-Time System

## 🎯 PROJECT GOAL

Build a full-stack real-time passenger density monitoring system for Baku Metro.
The system simulates AI camera data from train wagons, streams it via WebSocket,
and displays it on two separate UIs: an Admin Dashboard and a Station Monitor.

---

## 📁 MONOREPO STRUCTURE TO CREATE

```
baku-metro-ai/
├── backend/
│   ├── main.py               # FastAPI server + WebSocket broadcaster
│   ├── models.py             # Pydantic models
│   ├── state.py              # In-memory state store for all trains
│   └── requirements.txt
├── generator/
│   ├── generator.py          # Synthetic data generator (asyncio)
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── tailwind.config.js
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── AdminDashboard.tsx    # Shows ALL trains + ALL wagons
│       │   └── StationMonitor.tsx    # Shows ONE train (query param)
│       ├── components/
│       │   ├── TrainSilhouette.tsx
│       │   ├── WagonCard.tsx
│       │   └── DensityBadge.tsx
│       └── hooks/
│           └── useMetroSocket.ts     # WebSocket hook
└── docker-compose.yml        # Optional: spin everything up together
```

---

## ⚙️ BACKEND SPECIFICATION (`backend/`)

**Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2

### `models.py`
```python
# Define these Pydantic models:

class WagonData(BaseModel):
    wagon_id: int           # 1–5
    density: float          # 0.0–100.0 (percentage)
    status: str             # "Green" | "Yellow" | "Red"

class TrainUpdate(BaseModel):
    train_id: str           # "Train-1" … "Train-10"
    wagons: list[WagonData]
    timestamp: str          # ISO 8601, set by backend on receipt

class SystemState(BaseModel):
    trains: dict[str, TrainUpdate]   # keyed by train_id
    last_updated: str
```

### `state.py`
- Global `Dict[str, TrainUpdate]` stored in memory.
- Thread-safe via `asyncio.Lock`.
- `get_all_trains()` → returns full dict.
- `update_train(data: TrainUpdate)` → upserts by train_id.

### `main.py`
```
REST endpoints:
  POST /api/density
    - Accepts TrainUpdate JSON
    - Validates via Pydantic
    - Updates in-memory state
    - Broadcasts to ALL connected WebSocket clients
    - Returns: {"status": "ok", "train_id": "..."}

  GET /api/state
    - Returns current SystemState (snapshot of all trains)
    - Used by frontends on initial connect

WebSocket endpoints:
  WS /ws/admin
    - Sends full SystemState on connect (so dashboard loads instantly)
    - On every POST /api/density → broadcasts updated SystemState

  WS /ws/station/{train_id}
    - On connect: sends only that train's data
    - On every POST /api/density → if update is for this train_id,
      send only that train's WagonData list
    - Multiple stations can watch different trains simultaneously

CORS: allow all origins (hackathon mode)
```

### `requirements.txt`
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
websockets==12.0
```

---

## 🔄 GENERATOR SPECIFICATION (`generator/`)

**Stack:** Python 3.11+, asyncio, httpx (async HTTP)

### `generator.py` Logic

```
CONFIG:
  BACKEND_URL = "http://localhost:8000/api/density"
  NUM_TRAINS = 10          # Train-1 … Train-10
  WAGONS_PER_TRAIN = 5
  STATION_INTERVAL = 120   # seconds between station arrivals per train
  TRANSITION_STEPS = 10    # smooth update over 10 seconds
  TRANSITION_INTERVAL = 1  # 1 second per step

DATA FLOW:
1. Each train has independent asyncio task running in a loop.
2. Every STATION_INTERVAL seconds → "Station Arrival" event fires for that train.
3. On arrival:
   a. Generate NEW target density for each wagon (random float 0–100).
   b. Assign status: <40 = "Green", 40–75 = "Yellow", >75 = "Red".
   c. Over TRANSITION_STEPS × TRANSITION_INTERVAL seconds:
      - Interpolate wagon density linearly from current → target.
      - POST updated TrainUpdate to backend each step.
4. Trains are STAGGERED: Train-N starts with N*12 second offset,
   so arrivals don't all happen simultaneously.

STARTUP:
- On first run, initialize all trains with random densities.
- Post initial state to backend immediately.
- Then begin station interval loops.
```

### `requirements.txt`
```
httpx==0.27.0
```

---

## 🖥️ FRONTEND SPECIFICATION (`frontend/`)

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS v3, Framer Motion v11, React Router v6

### Routing
```
/admin          → AdminDashboard
/station?train=Train-1   → StationMonitor for Train-1
```

### `useMetroSocket.ts` Hook
```typescript
// Two modes:
// mode="admin"  → connects to ws://localhost:8000/ws/admin
//                 receives SystemState (all trains)
// mode="station" train_id="Train-3"
//              → connects to ws://localhost:8000/ws/station/Train-3
//                 receives WagonData[] for that train only

// On mount: send GET /api/state for instant data before WS connects
// Auto-reconnect on disconnect (exponential backoff, max 5s)
// Returns: { data, connectionStatus }
```

### `AdminDashboard.tsx`
```
LAYOUT:
- Header: "Baku Metro AI — Admin Dashboard" + live connection indicator (green dot / pulsing)
- Grid of ALL 10 trains (2 rows × 5 cols on desktop, responsive)
- Each train card shows:
    - Train ID ("Train-1")
    - Horizontal train silhouette with 5 wagon segments
    - Each wagon colored by status (Green/Yellow/Red)
    - Density % shown inside each wagon
    - Last updated timestamp

WAGON COLORS (Tailwind):
  Green  → bg-emerald-500  (< 40%)
  Yellow → bg-amber-400    (40–75%)
  Red    → bg-red-600      (> 75%)

ANIMATIONS (Framer Motion):
  - Wagon color transitions: 0.6s ease
  - Density number: animated counter (useSpring or layout animation)
  - New data pulse: brief scale(1.02) on card update
```

### `StationMonitor.tsx`
```
LAYOUT (designed for large screens / kiosk displays):
- Full screen dark background
- Top bar: Station name + train ID + "Next Train" indicator
- LARGE single train silhouette (full width)
- 5 wagon cards side by side, each showing:
    - Wagon number
    - LARGE density % (text-6xl)
    - Status label ("Rahat / Ayaqüstə / Aşırı Dolu") in Azerbaijani
    - Animated fill bar (height animates based on density)
- Bottom: "Recommended boarding" → highlight least-dense wagon

ANIMATIONS:
  - Fill bar: smooth height transition (0.8s ease-in-out)
  - Color change: crossfade 0.5s
  - Density number: rolling counter animation

URL PARAM: ?train=Train-1 (defaults to Train-1 if missing)
```

### `WagonCard.tsx`
```typescript
// Reusable component used in both pages
// Props: { wagon: WagonData, size: "sm" | "lg", showLabel?: boolean }
// "sm" → used in AdminDashboard grid
// "lg" → used in StationMonitor
// Animate density changes with Framer Motion useSpring
```

---

## 🐳 `docker-compose.yml`

```yaml
# Three services:
# 1. backend  → builds from ./backend, exposes :8000
# 2. frontend → builds from ./frontend, exposes :5173
# 3. generator → builds from ./generator, depends_on backend
#                waits 3s for backend to start, then runs generator.py

# All on same network "metro-net"
# Frontend VITE_API_URL and VITE_WS_URL env vars pointing to backend
```

---

## 🚀 IMPLEMENTATION ORDER

Claude Code, please implement in this exact order:

1. **`backend/models.py`** — Pydantic models
2. **`backend/state.py`** — In-memory state with asyncio lock
3. **`backend/main.py`** — FastAPI app with REST + WebSocket
4. **`generator/generator.py`** — Async synthetic data generator
5. **`frontend/` scaffold** — Vite + React + Tailwind + Framer Motion setup
6. **`frontend/src/hooks/useMetroSocket.ts`** — WebSocket hook
7. **`frontend/src/components/WagonCard.tsx`** — Reusable wagon component
8. **`frontend/src/components/TrainSilhouette.tsx`** — Train layout component
9. **`frontend/src/pages/AdminDashboard.tsx`** — Full admin view
10. **`frontend/src/pages/StationMonitor.tsx`** — Kiosk station view
11. **`docker-compose.yml`** — Compose file
12. **`README.md`** — Setup & run instructions

---

## ✅ ACCEPTANCE CRITERIA

- [ ] `POST /api/density` accepts valid JSON and updates state
- [ ] Admin Dashboard shows all 10 trains with live wagon colors
- [ ] Station Monitor shows 1 train, full-screen, with smooth animations
- [ ] Density changes animate smoothly over 10 seconds (no jumps)
- [ ] WebSocket reconnects automatically if backend restarts
- [ ] Generator staggers train arrivals (not all at once)
- [ ] All three services start with `docker-compose up`
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] Responsive: Admin Dashboard works on 1280px+ screens
- [ ] Station Monitor works on 1920×1080 (kiosk/TV)

---

## 🔧 ENVIRONMENT VARIABLES

```
# backend/.env
PORT=8000

# frontend/.env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_NUM_TRAINS=10
```

---

## 📝 NOTES FOR CLAUDE CODE

- Use `async/await` throughout — no blocking calls.
- Backend WebSocket manager must handle concurrent connections without data races.
- Generator must catch HTTP errors gracefully and retry.
- Frontend must handle the case where WebSocket data arrives before React state is ready.
- Prefer named exports for components, default exports for pages.
- All user-facing text on StationMonitor should be bilingual (AZ + EN).
- Do NOT use any paid APIs or external data sources — fully self-contained.
