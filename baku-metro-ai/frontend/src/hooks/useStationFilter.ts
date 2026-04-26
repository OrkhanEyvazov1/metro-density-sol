import { useMemo } from "react";

import type { SystemState, TrainUpdate } from "@/types/metro";

/**
 * Pick the single train that the station kiosk should display.
 *
 * Selection priority (V3 single-train rule):
 *   1. A train actively in transit toward this station
 *      (`next_station === stationName && arrival_progress < 1`).
 *      If multiple, the one with the highest `arrival_progress` wins.
 *   2. Otherwise, a train currently dwelling at this station
 *      (`next_station === stationName && arrival_progress >= 1`).
 *   3. Otherwise `null` (waiting state).
 *
 * No animation/cross-fade is performed here — callers should snap-replace
 * by keying on `train_id`.
 */
export function useStationFilter(
  systemState: SystemState | null,
  stationName: string
): TrainUpdate | null {
  return useMemo(() => {
    if (!systemState) return null;
    const trains = Object.values(systemState.trains);

    const inTransit = trains.filter(
      (t) => t.next_station === stationName && t.arrival_progress < 1
    );
    if (inTransit.length > 0) {
      return inTransit.reduce((a, b) =>
        a.arrival_progress >= b.arrival_progress ? a : b
      );
    }

    const dwelling = trains.find(
      (t) => t.next_station === stationName && t.arrival_progress >= 1
    );
    return dwelling ?? null;
  }, [systemState, stationName]);
}
