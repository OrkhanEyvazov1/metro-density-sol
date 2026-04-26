import { API_URL } from "./config";
import type { AlertEntry, SystemState, TrainUpdate } from "@/types/metro";

/** Thin REST client. Centralised so swapping the data source is trivial. */
export async function fetchSystemState(signal?: AbortSignal): Promise<SystemState> {
  const response = await fetch(`${API_URL}/api/state`, { signal });
  if (!response.ok) {
    throw new Error(`GET /api/state failed: ${response.status}`);
  }
  return (await response.json()) as SystemState;
}

export async function fetchAlerts(signal?: AbortSignal): Promise<AlertEntry[]> {
  const response = await fetch(`${API_URL}/api/alerts`, { signal });
  if (!response.ok) {
    throw new Error(`GET /api/alerts failed: ${response.status}`);
  }
  return (await response.json()) as AlertEntry[];
}

export async function fetchHistory(
  limit = 200,
  signal?: AbortSignal
): Promise<TrainUpdate[]> {
  const response = await fetch(`${API_URL}/api/history?limit=${limit}`, { signal });
  if (!response.ok) {
    throw new Error(`GET /api/history failed: ${response.status}`);
  }
  return (await response.json()) as TrainUpdate[];
}
