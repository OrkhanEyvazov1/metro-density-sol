import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { TrainUpdate } from "@/types/metro";
import { TrainSilhouette } from "./TrainSilhouette";
import { RouteProgressBar } from "./RouteProgressBar";
import {
  STATUS_BG,
  STATUS_LABEL_AZ,
  formatTimestamp,
  getEmptySeats,
} from "@/utils/density";

interface TrainDetailModalProps {
  /** When non-null the modal is open for that train. */
  train: TrainUpdate | null;
  onClose(): void;
}

/**
 * Live-updating train detail modal. Reuses the AdminDashboard's existing
 * /ws/admin stream — the parent passes the latest `TrainUpdate` for the
 * selected train on every render, so this component does not open its own
 * WebSocket.
 */
export function TrainDetailModal({ train, onClose }: TrainDetailModalProps) {
  // Esc key dismisses the modal.
  useEffect(() => {
    if (!train) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [train, onClose]);

  const summary = useMemo(() => {
    if (!train || train.wagons.length === 0) return null;
    const sum = train.wagons.reduce((acc, w) => acc + w.density, 0);
    const avg = sum / train.wagons.length;
    const least = train.wagons.reduce((best, w) =>
      w.density < best.density ? w : best
    );
    return { avg, least };
  }, [train]);

  return (
    <AnimatePresence>
      {train && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            key="modal-card"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-3xl rounded-2xl bg-metro-panel p-6 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold text-white">
                <span aria-hidden>🚇</span> {train.train_id}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bağla"
                className="rounded-md bg-metro-panel2/80 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/5 hover:bg-metro-panel2"
              >
                ✕
              </button>
            </header>

            <RouteProgressBar
              currentStation={train.current_station}
              nextStation={train.next_station}
              progress={train.arrival_progress}
              variant="compact"
            />

            <section className="mt-4">
              <TrainSilhouette wagons={train.wagons} size="sm" />
            </section>

            <section className="mt-5 overflow-hidden rounded-xl ring-1 ring-white/5">
              <table className="w-full text-left text-sm">
                <thead className="bg-metro-panel2/60 text-[11px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Vaqon</th>
                    <th className="px-4 py-2">Sıxlıq</th>
                    <th className="px-4 py-2">Boş Yer</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {train.wagons.map((w) => (
                    <tr key={w.wagon_id}>
                      <td className="px-4 py-2 font-semibold text-white">
                        {w.wagon_id}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-200">
                        {w.density.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 tabular-nums text-slate-200">
                        {getEmptySeats(w.density)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${STATUS_BG[w.status]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                          {STATUS_LABEL_AZ[w.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {summary && (
              <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-metro-panel2/40 px-4 py-3 text-sm ring-1 ring-white/5">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">
                    Ümumi Doluluq
                  </div>
                  <div className="text-lg font-bold tabular-nums text-white">
                    {summary.avg.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">
                    Ən az sıx vaqon
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    Vaqon {summary.least.wagon_id}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">
                    Son yenilənmə
                  </div>
                  <div className="font-mono text-sm text-slate-200">
                    {formatTimestamp(train.timestamp)}
                  </div>
                </div>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
