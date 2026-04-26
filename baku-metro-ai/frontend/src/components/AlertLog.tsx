import { AnimatePresence, motion } from "framer-motion";

import type { AlertEntry } from "@/types/metro";
import { alertKey } from "@/hooks/useAlerts";

interface AlertLogProps {
  /** Pre-paginated, newest-first list of entries to render. */
  entries: AlertEntry[];
  /** Optional clear callback — hidden if undefined. */
  onClear?: () => void;
  /** Optional title shown in the header (default "Kritik Vəziyyətlər Loqu"). */
  title?: string;
}

function formatRow(iso: string): string {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const date = d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${time}  ${date}`;
  } catch {
    return iso;
  }
}

export function AlertLog({
  entries,
  onClear,
  title = "Kritik Vəziyyətlər Loqu",
}: AlertLogProps) {
  return (
    <section className="flex flex-col rounded-2xl bg-metro-panel/80 ring-1 ring-white/5">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
          <span aria-hidden>🚨</span> {title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30">
            {entries.length}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={entries.length === 0}
              className="rounded-md bg-metro-panel2/60 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/5 transition hover:bg-metro-panel2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Loqu Təmizlə
            </button>
          )}
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-slate-500">
          Kritik hadisə qeyd edilməyib
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-metro-panel2/60 text-[11px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-5 py-2">Tarix/Saat</th>
                <th className="px-5 py-2">Qatar ID</th>
                <th className="px-5 py-2">Stansiya</th>
                <th className="px-5 py-2">Ümumi Sıxlıq</th>
                <th className="px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {entries.map((a) => (
                  <motion.tr
                    key={alertKey(a)}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.25 }}
                    className="bg-red-950/30 hover:bg-red-950/40"
                  >
                    <td className="whitespace-nowrap px-5 py-2 font-mono text-[12px] text-slate-300">
                      {formatRow(a.timestamp)}
                    </td>
                    <td className="px-5 py-2 font-semibold text-white">
                      {a.train_id}
                    </td>
                    <td className="px-5 py-2 text-slate-200">{a.station}</td>
                    <td className="px-5 py-2 font-bold tabular-nums text-red-400">
                      {a.overall_density.toFixed(1)}%
                    </td>
                    <td className="px-5 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                        Kritİk
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
