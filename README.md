# 🚇 Baku Metro AI — Real-Time Passenger Density System

A full-stack monorepo that simulates AI camera data from Baku Metro train
wagons, ingests it through a FastAPI backend, and streams it live to two
React UIs:

- **Admin Dashboard** (`/admin`) — fleet-wide overview of every train
- **Station Monitor** (`/station?train=Train-1`) — kiosk view for a single
  train with bilingual (AZ + EN) status and a recommended-boarding hint

## 🏛 Architecture

```
┌─────────────┐     POST /api/density      ┌─────────────┐
│  Generator  │ ─────────────────────────► │   Backend   │
│ (mock cams) │                            │  FastAPI +  │
└─────────────┘                            │  WebSocket  │
                                           └──────┬──────┘
                                                  │  WS broadcast
                            ┌─────────────────────┼─────────────────────┐
                            ▼                                           ▼
                   /ws/admin (SystemState)                    /ws/station/{id}
                            │                                           │
                            ▼                                           ▼
                ┌───────────────────────┐                   ┌────────────────────┐
                │ React Admin Dashboard │                   │ React Station Kiosk│
                └───────────────────────┘                   └────────────────────┘
```

### 🔄 Mock → Real Data Swap

The **generator** service is the only mock layer. Real AI cameras can
replace it with **zero changes** to backend or frontend — they only need
to POST a `TrainUpdate` JSON to `/api/density`:

```json
{
  "train_id": "Train-1",
  "wagons": [
    { "wagon_id": 1, "density": 42.5, "status": "Yellow" },
    { "wagon_id": 2, "density": 12.0, "status": "Green" }
  ]
}
```

To switch off the mock simply stop the `generator` service and point real
cameras at the same endpoint.

## 📁 Repository Layout

```
baku-metro-ai/
├── backend/               # FastAPI app (REST + WebSocket)
│   └── app/
│       ├── main.py        # App factory & CORS
│       ├── config.py      # Pydantic settings
│       ├── models.py      # Pydantic v2 wire models
│       ├── state.py       # In-memory store (asyncio.Lock)
│       ├── ws_manager.py  # ConnectionManager (admin + station rooms)
│       └── routes/
│           ├── density.py     # POST /api/density, GET /api/state, /api/health
│           └── websockets.py  # /ws/admin, /ws/station/{train_id}
├── generator/             # Async mock-camera simulator
│   ├── generator.py
│   └── config.py
├── frontend/              # React 18 + TS + Tailwind + Framer Motion
│   └── src/
│       ├── api/           # REST client (data-source swap layer)
│       ├── components/    # WagonCard, TrainSilhouette, …
│       ├── hooks/         # useMetroSocket, useAnimatedNumber
│       ├── pages/         # AdminDashboard, StationMonitor, Landing
│       ├── types/         # Wire-format types (mirror Pydantic models)
│       └── utils/         # Density labels, status colour map
└── docker-compose.yml
```

## 🚀 Quick Start

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

- Backend → http://localhost:8000  (Swagger UI at `/docs`)
- Frontend → http://localhost:5173

### Option B — Manual (three terminals)

**1. Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**2. Generator**

```bash
cd generator
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python generator.py
```

**3. Frontend**

```bash
cd frontend
npm install               # add `--no-bin-links` if on a FAT32/exFAT volume
cp .env.example .env
npm run dev
```

Visit:

- http://localhost:5173/         (Landing)
- http://localhost:5173/admin    (Admin Dashboard)
- http://localhost:5173/station?train=Train-3   (Kiosk for Train-3)

## ⚙️ API Reference

| Method | Path                       | Description                                    |
| ------ | -------------------------- | ---------------------------------------------- |
| POST   | `/api/density`             | Ingest a `TrainUpdate` snapshot                |
| GET    | `/api/state`               | Current `SystemState` snapshot (all trains)   |
| GET    | `/api/health`              | Liveness probe                                 |
| WS     | `/ws/admin`                | Stream of full `SystemState` updates           |
| WS     | `/ws/station/{train_id}`   | Stream of `TrainUpdate` for one train          |

### Density Status Mapping

| Density (%) | Status | AZ          | EN            |
| ----------- | ------ | ----------- | ------------- |
| `< 40`      | Green  | Rahat       | Comfortable   |
| `40 – 75`   | Yellow | Ayaqüstə    | Standing      |
| `> 75`      | Red    | Aşırı Dolu  | Overcrowded   |

## 🔧 Environment Variables

### `backend/.env`

```
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGINS=*
```

### `generator/` (env)

```
BACKEND_URL=http://localhost:8000/api/density
NUM_TRAINS=10
WAGONS_PER_TRAIN=5
STATION_INTERVAL=120
TRANSITION_STEPS=10
TRANSITION_INTERVAL=1
TRAIN_STAGGER=12
STARTUP_DELAY=3
```

### `frontend/.env`

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_NUM_TRAINS=10
```

## 🧪 Smoke Test

While the stack is running:

```bash
# 1. Inspect current snapshot
curl -s http://localhost:8000/api/state | jq '.trains | keys'

# 2. Push a manual density update
curl -s -X POST http://localhost:8000/api/density \
  -H 'content-type: application/json' \
  -d '{
    "train_id":"Train-1",
    "wagons":[
      {"wagon_id":1,"density":12.0,"status":"Green"},
      {"wagon_id":2,"density":55.0,"status":"Yellow"},
      {"wagon_id":3,"density":88.0,"status":"Red"},
      {"wagon_id":4,"density":33.0,"status":"Green"},
      {"wagon_id":5,"density":71.0,"status":"Yellow"}
    ]
  }'
```

Both UIs should reflect the change instantly.

## 🛡 Engineering Standards

- **SOLID / clean code** — each module owns one responsibility (state,
  fan-out, routing, config). FastAPI dependency injection is used
  throughout.
- **Security** — strict Pydantic validation (`extra="forbid"`, regex on
  `train_id`, range checks on density), backend-stamped timestamps,
  configurable CORS, no secrets in source.
- **Resilience** — async generator retries with exponential backoff,
  WebSocket dead-connection cleanup, frontend reconnect with capped
  backoff.
- **Type safety** — Pydantic v2 on the backend, `tsc --noEmit` clean on
  the frontend, shared wire-format types kept in sync.

## 📜 License

MIT — built for the Baku Metro hackathon.
