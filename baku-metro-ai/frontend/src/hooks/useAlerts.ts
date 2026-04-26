import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAlerts } from "@/api/metroClient";
import type { AlertEntry } from "@/types/metro";

interface UseAlertsResult {
  /** Newest first, with locally-cleared keys filtered out. */
  alerts: AlertEntry[];
  /** "loading" only on the *initial* fetch; refetches do not flip back. */
  isLoading: boolean;
  /** Last fetch error, if any. */
  error: Error | null;
  /** Re-fetch the alert log (used by the "Loqu Yenilə" button). */
  refresh(): Promise<void>;
  /** Hide all currently-visible entries (client-side only). */
  clearAlerts(): void;
}

/** Stable de-dup key (timestamp + train collisions are negligible in practice). */
function alertKey(a: AlertEntry): string {
  return `${a.timestamp}|${a.train_id}`;
}

/**
 * Single-responsibility hook around `GET /api/alerts`.
 *
 * Owns: fetch + cache + locally-cleared key set.
 * Does NOT own: WebSocket merging — callers can pass `liveAlerts` from the
 * `SystemState.alert_log` if they want a live-merged view (see
 * `mergeWithLive`).
 */
export function useAlerts(): UseAlertsResult {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [clearedKeys, setClearedKeys] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const fresh = await fetchAlerts();
      setAlerts(fresh);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAlerts()
      .then((fresh) => {
        if (!cancelled) {
          setAlerts(fresh);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearAlerts = useCallback((): void => {
    setClearedKeys((prev) => {
      const next = new Set(prev);
      for (const a of alerts) next.add(alertKey(a));
      return next;
    });
  }, [alerts]);

  const visible = useMemo(
    () => alerts.filter((a) => !clearedKeys.has(alertKey(a))),
    [alerts, clearedKeys]
  );

  return { alerts: visible, isLoading, error, refresh, clearAlerts };
}

/**
 * Merge a "live" alert stream (from SystemState.alert_log on /ws/admin)
 * with a stored list, deduping by `alertKey`. Newest first.
 */
export function mergeWithLive(
  stored: AlertEntry[],
  live: AlertEntry[]
): AlertEntry[] {
  const seen = new Set<string>();
  const out: AlertEntry[] = [];
  for (const a of [...live, ...stored]) {
    const k = alertKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export { alertKey };
