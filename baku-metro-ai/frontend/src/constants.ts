/**
 * Shared frontend constants. Mirror backend constants exactly:
 *   - STATION_LIST  ↔ backend `app.models.STATION_LIST`
 *   - GREEN_MAX / YELLOW_MAX  ↔ backend density thresholds
 */

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

export type StationName = (typeof STATION_LIST)[number];

/** Default station shown by /station when no `?name=` query param is given. */
export const DEFAULT_STATION_NAME: StationName = STATION_LIST[0];

/** Used to derive empty-seat counts on the kiosk view. */
export const TOTAL_SEATS_PER_WAGON = 40;

/** Density thresholds — must match backend `RED_THRESHOLD` and friends. */
export const DENSITY_THRESHOLDS = {
  GREEN: 40,
  YELLOW: 75,
} as const;

/**
 * Generator timing — must mirror `generator/config.py`.
 * Used by the kiosk countdown to convert `arrival_progress` → seconds.
 */
export const PHASE_A_STEPS = 30; // Transit ticks (1s each)
export const PHASE_B_STEPS = 10; // Boarding ticks (1s each)
export const PHASE_C_SECONDS = 5; // Idle (no POSTs)
export const CYCLE_SECONDS = PHASE_A_STEPS + PHASE_B_STEPS + PHASE_C_SECONDS;

/** Frontend-side reconnect ceiling for the WebSocket exponential backoff. */
export const WS_RECONNECT_MAX_DELAY_MS = 5000;

/** Page size for /admin/alerts pagination. */
export const ALERT_PAGE_SIZE = 20;

/** Auth (sessionStorage-only — no backend auth endpoint). */
export const AUTH_TOKEN_KEY = "metro_admin_token";
export const AUTH_TOKEN_VALUE = "metro_admin_token";
export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "metro2025",
} as const;
/** @deprecated kept for back-compat with existing imports — use ADMIN_CREDENTIALS. */
export const ADMIN_USERNAME = ADMIN_CREDENTIALS.username;
/** @deprecated kept for back-compat with existing imports — use ADMIN_CREDENTIALS. */
export const ADMIN_PASSWORD = ADMIN_CREDENTIALS.password;
