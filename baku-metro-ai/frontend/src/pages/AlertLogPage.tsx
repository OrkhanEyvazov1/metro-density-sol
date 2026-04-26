import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlertLog } from "@/components/AlertLog";
import { ALERT_PAGE_SIZE } from "@/constants";
import { useAlerts } from "@/hooks/useAlerts";

/**
 * `/admin/alerts` — full-page critical-event log.
 *
 * Source of truth: `GET /api/alerts` (see `useAlerts`). The live
 * `SystemState.alert_log` is intentionally not merged here — operators
 * navigate to this page for the historical view, not the live ticker.
 */
export default function AlertLogPage(): JSX.Element {
  const navigate = useNavigate();
  const { alerts, isLoading, error, refresh, clearAlerts } = useAlerts();
  const [page, setPage] = useState<number>(0);

  const totalPages = Math.max(1, Math.ceil(alerts.length / ALERT_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const pageEntries = useMemo(() => {
    const start = safePage * ALERT_PAGE_SIZE;
    return alerts.slice(start, start + ALERT_PAGE_SIZE);
  }, [alerts, safePage]);

  return (
    <div className="min-h-screen gradient-bg">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-metro-bg/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-lg bg-metro-panel2/60 px-3 py-1.5 text-sm font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-metro-panel2"
            >
              ← Admin Panelə Qayıt
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              🚨 Kritik Vəziyyətlər Loqu
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="rounded-lg bg-metro-panel2/60 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-metro-panel2"
            >
              Loqu Yenilə
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
            Xəta: {error.message}
          </div>
        )}

        <AlertLog entries={pageEntries} onClear={clearAlerts} />

        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalEntries={alerts.length}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  totalEntries: number;
  isLoading: boolean;
  onPageChange(next: number): void;
}

function Pagination({
  page,
  totalPages,
  totalEntries,
  isLoading,
  onPageChange,
}: PaginationProps): JSX.Element {
  const isFirst = page <= 0;
  const isLast = page >= totalPages - 1;

  return (
    <nav className="mt-4 flex items-center justify-between rounded-xl bg-metro-panel/60 px-4 py-3 text-sm text-slate-300 ring-1 ring-white/5">
      <span>
        {isLoading
          ? "Yüklənir…"
          : `Səhifə ${page + 1} / ${totalPages} · ${totalEntries} qeyd`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={isFirst}
          className="rounded-md bg-metro-panel2/70 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/5 transition hover:bg-metro-panel2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Əvvəlki
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLast}
          className="rounded-md bg-metro-panel2/70 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/5 transition hover:bg-metro-panel2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Növbəti →
        </button>
      </div>
    </nav>
  );
}
