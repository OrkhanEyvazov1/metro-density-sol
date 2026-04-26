/**
 * Wire-format types — MUST stay aligned with backend `app/models.py`.
 * Treat this file as the single source of truth on the frontend side.
 */

export type WagonStatus = "Green" | "Yellow" | "Red";

export interface WagonData {
  wagon_id: number;
  density: number;
  status: WagonStatus;
}

export interface TrainUpdate {
  train_id: string;
  wagons: WagonData[];
  timestamp: string;
  /** Station the train just departed from. */
  current_station: string;
  /** Station the train is arriving at. */
  next_station: string;
  /** 0.0 (just left previous) → 1.0 (arrived at next). */
  arrival_progress: number;
}

/**
 * V3 schema: one entry per train update whose AVERAGE wagon density
 * crossed the Red threshold (75%). Replaces the V2 per-wagon shape.
 */
export interface AlertEntry {
  timestamp: string;
  train_id: string;
  station: string;
  overall_density: number;
  status: WagonStatus; // always "Red"
}

export interface SystemState {
  trains: Record<string, TrainUpdate>;
  last_updated: string;
  /** Newest first (server reverses); up to 50 latest critical events. */
  alert_log: AlertEntry[];
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

/** Density thresholds — MUST match backend `models.py`. */
export const GREEN_MAX = 40;
export const YELLOW_MAX = 75;

export function classifyDensity(density: number): WagonStatus {
  if (density < GREEN_MAX) return "Green";
  if (density <= YELLOW_MAX) return "Yellow";
  return "Red";
}
