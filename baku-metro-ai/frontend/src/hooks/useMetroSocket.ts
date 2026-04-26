import { useEffect, useRef, useState } from "react";

import { fetchSystemState } from "@/api/metroClient";
import { WS_URL } from "@/api/config";
import { WS_RECONNECT_MAX_DELAY_MS } from "@/constants";
import type { ConnectionStatus, SystemState } from "@/types/metro";

interface UseMetroSocketResult {
  data: SystemState | null;
  connectionStatus: ConnectionStatus;
}

/**
 * Admin-only WebSocket hook (V3).
 *
 * Connects to `/ws/admin`, seeds with `/api/state`, and exposes the latest
 * `SystemState`. Components that need a single train (e.g. the kiosk
 * StationMonitor) filter the SystemState themselves — see
 * `useStationFilter`.
 *
 * - Auto-reconnect with exponential backoff capped at
 *   `WS_RECONNECT_MAX_DELAY_MS`.
 * - Cancels any in-flight REST request and timer on unmount.
 */
export function useMetroSocket(): UseMetroSocketResult {
  const [data, setData] = useState<SystemState | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const abortController = new AbortController();

    // 1) Seed UI with REST snapshot (fast first paint).
    fetchSystemState(abortController.signal)
      .then((snapshot) => {
        if (!cancelledRef.current) setData(snapshot);
      })
      .catch(() => {
        /* ignore — WS will catch up */
      });

    // 2) Open WebSocket with auto-reconnect.
    const url = `${WS_URL}/ws/admin`;

    function connect() {
      if (cancelledRef.current) return;
      setConnectionStatus("connecting");

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionStatus("open");
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as SystemState;
          setData(parsed);
        } catch {
          /* ignore malformed frame */
        }
      };

      socket.onerror = () => {
        setConnectionStatus("error");
      };

      socket.onclose = () => {
        setConnectionStatus("closed");
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelledRef.current) return;
      const attempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempt;
      const delay = Math.min(
        WS_RECONNECT_MAX_DELAY_MS,
        250 * 2 ** attempt
      );
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    }

    connect();

    return () => {
      cancelledRef.current = true;
      abortController.abort();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        try {
          wsRef.current.close();
        } catch {
          /* noop */
        }
        wsRef.current = null;
      }
    };
  }, []);

  return { data, connectionStatus };
}
