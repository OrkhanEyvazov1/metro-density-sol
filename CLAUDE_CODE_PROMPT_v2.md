# Claude Code Prompt — Baku Metro AI: Passenger Density Real-Time System
# VERSION 2 — INCREMENTAL CHANGES (existing Docker project is already running)

> **CONTEXT FOR CLAUDE CODE:**
> The base project is already built and running via `docker-compose up`.
> Backend (FastAPI :8000), Frontend (React/Vite :5173), Generator are all functional.
> This prompt describes ONLY the new changes to implement on top of the existing codebase.
> Do NOT rewrite working files unless a change explicitly touches them.
> Make surgical edits. After each change, verify Docker still builds cleanly.

---

## 🗺️ BAKU METRO STATIONS (Reference — use throughout all changes)

```
STATION_LIST = [
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
  "Nəriman Nərimanov"
]
```

Each train travels along this list in order (index 0 → 10), then reverses.
Generator must assign each train a `current_station_index` and `next_station_index`
from this list, advancing on every Station Arrival event.

---

## CHANGE 1 — Login Page (Landing → Admin)

### What to build
A simple login page that guards the `/admin` route.

### Files to create/modify
- **CREATE** `frontend/src/pages/LoginPage.tsx`
- **MODIFY** `frontend/src/App.tsx` — wrap `/admin` in a `<ProtectedRoute>` component

### LoginPage.tsx specification
```
LAYOUT:
- Full-screen centered card on a dark background (same dark theme as rest of app)
- Baku Metro logo / title at top: "Baku Metro AI" subtitle: "Admin Panel"
- Two fields: Username (text), Password (password)
- "Daxil ol" (Login) button
- On failed login: shake animation on card + red error text "İstifadəçi adı və ya şifrə yanlışdır"

CREDENTIALS (hardcoded, no backend needed):
  username: "admin"
  password: "metro2025"

AUTH STATE:
- On success: save token "metro_admin_token" to sessionStorage
- Use a React Context (AuthContext) so ProtectedRoute and Header can read auth state
- "Çıxış" (Logout) button in Admin Dashboard header → clears sessionStorage, redirects to /login

ROUTING:
  /           → redirect to /login
  /login      → LoginPage (public)
  /admin      → AdminDashboard (protected — redirect to /login if not authed)
  /station    → StationMonitor (public — no login needed, it's a kiosk display)

ANIMATIONS (Framer Motion):
- Card fade+slide-up on mount
- Error: x-axis shake keyframe (translateX oscillation)
```

---

## CHANGE 2 — Alert History Log in Admin Dashboard

### What to build
A sidebar panel on the Admin Dashboard that logs every wagon that crosses the Red threshold (density > 75%).

### Files to create/modify
- **CREATE** `frontend/src/components/AlertLog.tsx`
- **MODIFY** `frontend/src/pages/AdminDashboard.tsx` — add AlertLog as right sidebar

### Backend change (REQUIRED)
- **MODIFY** `backend/state.py`:
  - Add `alert_log: list[AlertEntry]` to state (max 200 entries, FIFO drop oldest).
  - `AlertEntry` fields: `timestamp` (ISO), `train_id`, `wagon_id`, `density`, `status="Red"`.
  - On every `update_train()` call: for each wagon where `density > 75`, append AlertEntry.
- **MODIFY** `backend/models.py`: add `AlertEntry` Pydantic model.
- **MODIFY** `backend/main.py`:
  - Add `GET /api/alerts` → returns last 200 AlertEntry items (newest first).
  - Include `alert_log` (last 50) in the SystemState broadcast so Admin Dashboard
    gets it over WebSocket without an extra HTTP call.

### AlertLog.tsx specification
```
LAYOUT:
- Fixed right sidebar, width 380px, full height, scrollable
- Header: "🚨 Kritik Vəziyyətlər Loqu" + badge showing total count
- Table with columns:
    Tarix/Saat | Qatar ID | Vaqon No | Sıxlıq (%) | Status
- Each row: red-tinted background (bg-red-950/40), monospace timestamp
- New rows slide in from top with Framer Motion (AnimatePresence)
- "Loqu Təmizlə" (Clear Log) button at bottom → clears local display only (no backend call)
- If log is empty: centered message "Kritik hadisə qeyd edilməyib"

DATA SOURCE:
- Populated from `systemState.alert_log` arriving over /ws/admin WebSocket
- On component mount also fetch GET /api/alerts to pre-populate before first WS message

COLUMN FORMAT:
  Tarix/Saat  → "HH:MM:SS  DD.MM.YYYY"  (local time)
  Qatar ID    → "Train-3"
  Vaqon No    → "Vaqon 2"
  Sıxlıq (%) → "87.4%"  (red bold)
  Status      → red badge "DOLU"
```

### Admin Dashboard layout change
```
OLD layout: full-width train grid
NEW layout: CSS Grid → [train grid (flex-1)] [AlertLog sidebar (380px fixed right)]
On screens < 1400px: AlertLog collapses to a slide-out drawer (toggle button in header)
```

---

## CHANGE 3 — Station Monitor: Animated Route Progress (top bar)

### What to build
Replace the current top bar (which shows Train ID, station name) with an animated
route progress bar showing the train moving from its previous station toward the next.

### Files to modify
- **MODIFY** `frontend/src/pages/StationMonitor.tsx`
- **MODIFY** `backend/state.py` + `backend/main.py` (generator must send station data)
- **MODIFY** `generator/generator.py` (must include station info in each TrainUpdate)

### Generator change
```python
# Each TrainUpdate payload must now include:
{
  "train_id": "Train-1",
  "current_station": "Nizami",        # station train just departed from
  "next_station": "28 May",           # station train is arriving at
  "arrival_progress": 0.0,            # 0.0 (just left) → 1.0 (arrived), float
  "wagons": [...]
}

# arrival_progress increments each TRANSITION step:
# step 0/10 → 0.0, step 5/10 → 0.5, step 10/10 → 1.0
# On new Station Arrival event: current_station = old next_station,
#   next_station = advance along STATION_LIST (wrap/reverse at ends),
#   arrival_progress resets to 0.0
```

### Backend model change
```python
class TrainUpdate(BaseModel):
    train_id: str
    wagons: list[WagonData]
    timestamp: str
    current_station: str = "Dərnəgül"
    next_station: str = "Azadlıq prospekti"
    arrival_progress: float = 0.0      # 0.0–1.0
```

### StationMonitor top bar — NEW design
```
REMOVE: Train ID text, static station name, "Next Train" indicator

ADD: Full-width animated route strip (height ~120px), dark background

VISUAL LAYOUT of the strip:
  [Current Station Name]  ●━━━━━━━━━━━━━━━━━●  [Next Station Name]
                                  🚇 (train icon moves along the line)

- The horizontal line spans the full width.
- Train icon (🚇 or SVG metro icon) position = arrival_progress × line_width (px).
- Framer Motion `animate={{ x: progress }}` with `transition={{ ease: "linear", duration: 1 }}`.
- Station dots at each end pulse gently.
- Current station label: left-aligned, dimmer color.
- Next station label: right-aligned, bright white, slightly larger font.
- Below the line, centered: "Növbəti stansiya:" label in small uppercase gray text.

DO NOT SHOW: train number, train ID, any numeric identifiers on this page.
```

---

## CHANGE 4 — Station Monitor: Empty Seats Instead of Density %, Bilingual Labels

### What to build
Replace density percentage display with estimated **empty seat count**.
Update all status labels to new Azerbaijani + English bilingual format.

### Files to modify
- **MODIFY** `frontend/src/pages/StationMonitor.tsx`
- **MODIFY** `frontend/src/components/WagonCard.tsx` (size="lg" variant only)

### Seat calculation logic (frontend only, no backend change)
```typescript
const TOTAL_SEATS_PER_WAGON = 40; // assume each wagon holds 40 seated passengers

function getEmptySeats(density: number): number {
  // density 0% → 40 empty seats
  // density 100% → 0 empty seats
  const occupied = Math.round((density / 100) * TOTAL_SEATS_PER_WAGON);
  return Math.max(0, TOTAL_SEATS_PER_WAGON - occupied);
}
```

### WagonCard (size="lg") display — NEW
```
OLD:  Large density % number (text-6xl)
NEW:
  - Large empty seat count (text-6xl bold): e.g. "23"
  - Below it: small label "boş yer" (AZ) / "empty seats" (EN) — stacked, smaller font
  - Status label block (two lines):
      Line 1 (AZ, larger): "Rahat" | "Ayaqüstə" | "Dolu"
      Line 2 (EN, smaller, gray): "Comfortable" | "Standing" | "Full"

STATUS MAPPING:
  density < 40%   → AZ: "Rahat"      EN: "Comfortable"   color: emerald
  40–75%          → AZ: "Ayaqüstə"   EN: "Standing"       color: amber
  > 75%           → AZ: "Dolu"       EN: "Full"           color: red

NOTE: "Aşırı Dolu" is retired — use "Dolu" / "Full" for > 75%.

ANIMATED fill bar: still present, still based on density internally.
The seat count animates with Framer Motion useSpring (same as density counter was).
```

---

## CHANGE 5 — Admin Dashboard: Clickable Train Cards → Detail Modal

### What to build
Each train card in the Admin Dashboard grid becomes clickable.
Clicking opens a full detail modal/panel for that train.

### Files to create/modify
- **CREATE** `frontend/src/components/TrainDetailModal.tsx`
- **MODIFY** `frontend/src/pages/AdminDashboard.tsx` — add click handler + modal state
- **MODIFY** `frontend/src/components/TrainSilhouette.tsx` — add `onClick`, `cursor-pointer`, hover effect

### TrainDetailModal.tsx specification
```
TRIGGER: Click on any train card in the grid
DISMISS: Click outside modal, or X button, or Escape key

LAYOUT (centered modal, max-width 720px, dark card):
┌─────────────────────────────────────────────┐
│  🚇 Train-3                            [X]  │
│  Nizami  →→→  28 May                        │
│  ─────────────────────────────────────────  │
│  [Large train silhouette — all 5 wagons]    │
│  ─────────────────────────────────────────  │
│  WAGON DETAILS TABLE:                       │
│  Vaqon | Sıxlıq | Boş Yer | Status         │
│    1   |  82%   |   7     |  🔴 Dolu       │
│    2   |  34%   |  26     |  🟢 Rahat      │
│    3   |  61%   |  16     |  🟡 Ayaqüstə   │
│    4   |  91%   |   4     |  🔴 Dolu       │
│    5   |  47%   |  21     |  🟡 Ayaqüstə   │
│  ─────────────────────────────────────────  │
│  Ümumi Doluluq: 63%  │  Ən boş: Vaqon 2   │
│  Son yenilənmə: 14:32:07                    │
└─────────────────────────────────────────────┘

FIELDS TO SHOW:
- Train ID (large header)
- Current → Next station (with animated mini route line, same as StationMonitor)
- Large train silhouette with live-updating wagon colors (still connected to WS)
- Wagon detail table:
    Column 1: Vaqon (1–5)
    Column 2: Sıxlıq (density %) — color coded
    Column 3: Boş Yer (empty seats, same formula as Change 4)
    Column 4: Status (AZ label + colored dot)
- Summary row:
    "Ümumi Doluluq" = average density across all 5 wagons (%)
    "Ən az sıx vaqon" = wagon_id with lowest density → "Vaqon N"
    "Son yenilənmə" = timestamp of last update (HH:MM:SS)

LIVE UPDATES:
- Modal stays open and data updates in real-time from existing /ws/admin stream.
- No additional WebSocket connection needed — filter from systemState by train_id.

ANIMATIONS:
- Modal: scale(0.95)→scale(1) + fade on open (Framer Motion AnimatePresence)
- Wagon colors in modal update with same 0.6s transition as grid cards
- Density numbers animate with useSpring

TRAIN CARD hover state (in grid):
- scale(1.03) + subtle border highlight + cursor-pointer
- Brief tooltip on hover: "Ətraflı bax" (View Details)
```

---

## 📁 UPDATED FILE TREE (new + changed files only)

```
frontend/src/
├── contexts/
│   └── AuthContext.tsx           ← NEW (Change 1)
├── pages/
│   ├── LoginPage.tsx             ← NEW (Change 1)
│   ├── AdminDashboard.tsx        ← MODIFIED (Changes 2, 5)
│   └── StationMonitor.tsx        ← MODIFIED (Changes 3, 4)
├── components/
│   ├── AlertLog.tsx              ← NEW (Change 2)
│   ├── TrainDetailModal.tsx      ← NEW (Change 5)
│   ├── TrainSilhouette.tsx       ← MODIFIED (Change 5 — hover/click)
│   └── WagonCard.tsx             ← MODIFIED (Change 4 — lg variant)
└── App.tsx                       ← MODIFIED (Change 1 — routing + ProtectedRoute)

backend/
├── models.py                     ← MODIFIED (Changes 2, 3)
├── state.py                      ← MODIFIED (Change 2)
└── main.py                       ← MODIFIED (Change 2)

generator/
└── generator.py                  ← MODIFIED (Change 3 — station progress)
```

---

## 🚀 IMPLEMENTATION ORDER

Implement in this order to avoid breaking the running system:

1. **Backend models** — add `AlertEntry`, `current_station`, `next_station`, `arrival_progress` to models.py
2. **Backend state** — add alert_log logic to state.py
3. **Backend main** — add `GET /api/alerts`, include alert_log in WS broadcast
4. **Generator** — add station tracking + `arrival_progress` to TrainUpdate payloads
5. **AuthContext + LoginPage** — auth context, login form, ProtectedRoute
6. **App.tsx routing** — update routes (/, /login, /admin protected, /station public)
7. **AlertLog component** — sidebar alert table with AnimatePresence
8. **AdminDashboard** — integrate AlertLog sidebar + responsive layout
9. **WagonCard (lg variant)** — switch to empty seats + bilingual labels
10. **StationMonitor top bar** — animated route progress line
11. **TrainDetailModal** — clickable cards + detail modal
12. **Verify** — `docker-compose build && docker-compose up` — all services healthy

---

## ✅ UPDATED ACCEPTANCE CRITERIA

- [ ] `/` redirects to `/login`
- [ ] Login with wrong credentials shows shake animation + error message
- [ ] Login with `admin` / `metro2025` → session stored → redirect to `/admin`
- [ ] Logout button clears session → redirects to `/login`
- [ ] `/station` is publicly accessible without login
- [ ] Alert log shows ONLY wagons with density > 75%
- [ ] Alert log new entries animate in from top (AnimatePresence)
- [ ] Alert log sidebar collapses on screens < 1400px
- [ ] Station Monitor top bar shows NO train ID or number
- [ ] Station Monitor top bar shows animated train icon moving between two station names
- [ ] `arrival_progress` drives train icon position smoothly (0→1 over 10 seconds)
- [ ] Station Monitor shows empty seat count (not density %) — range 0–40
- [ ] Status labels are bilingual: AZ on top, EN below in gray
- [ ] Clicking a train card in Admin opens TrainDetailModal
- [ ] Modal shows: Train ID, route, silhouette, wagon table, summary stats
- [ ] Modal data updates live from existing WebSocket stream
- [ ] Modal closes on Escape / outside click / X button
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] `docker-compose build` succeeds with no errors

---

## 🔧 NO NEW ENVIRONMENT VARIABLES NEEDED

All changes are frontend/logic only except the backend model additions.
Existing `.env` files remain unchanged.

---

## 📝 NOTES FOR CLAUDE CODE

- Do NOT change the WebSocket protocol or endpoint URLs — existing connections must keep working.
- The `arrival_progress` field is optional (has default) so old generator payloads won't break backend.
- Auth is sessionStorage only — no JWT, no backend auth endpoint needed.
- AlertLog data is derived from the existing `/ws/admin` stream (field `alert_log`) — no new WS connection.
- Station list is static (defined above) — hardcode in both generator and frontend constants file.
- `TOTAL_SEATS_PER_WAGON = 40` is a frontend constant — put it in `src/constants.ts`.
- TrainDetailModal must NOT open a new WebSocket — reuse the existing AdminDashboard WS data via prop or context.
