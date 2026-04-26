import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { TrainDetailModal } from "@/components/TrainDetailModal";
import { TrainSilhouette } from "@/components/TrainSilhouette";
import { useAuth } from "@/hooks/useAuth";
import { useMetroSocket } from "@/hooks/useMetroSocket";
import type { TrainUpdate } from "@/types/metro";
import { formatTimestamp } from "@/utils/density";

function trainSortKey(id: string): number {
  const match = id.match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function averageDensity(train: TrainUpdate): number {
  if (!train.wagons.length) return 0;
  const sum = train.wagons.reduce((acc, w) => acc + w.density, 0);
  return sum / train.wagons.length;
}

export default function AdminDashboard(): JSX.Element {
  const { data, connectionStatus } = useMetroSocket();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);

  const trains = useMemo(() => {
    if (!data) return [];
    return Object.values(data.trains).sort(
      (a, b) => trainSortKey(a.train_id) - trainSortKey(b.train_id)
    );
  }, [data]);

  const totalWagons = trains.reduce((acc, t) => acc + t.wagons.length, 0);
  const overcrowded = trains.reduce(
    (acc, t) => acc + t.wagons.filter((w) => w.status === "Red").length,
    0
  );

  const alertLogCount = data?.alert_log.length ?? 0;
  const selectedTrain = selectedTrainId
    ? data?.trains[selectedTrainId] ?? null
    : null;

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen gradient-bg">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-metro-bg/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Baku Metro AI{" "}
              <span className="text-metro-accent">— Admin Dashboard</span>
            </h1>
            <p className="text-xs text-slate-400">
              Real-time passenger density across the fleet
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Stat label="Trains" value={trains.length} />
            <Stat label="Wagons" value={totalWagons} />
            <Stat label="Overcrowded" value={overcrowded} accent="text-red-400" />
            <ConnectionIndicator status={connectionStatus} />
            <button
              type="button"
              onClick={() => navigate("/admin/alerts")}
              className="relative rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-500/40 transition hover:bg-red-600/30"
            >
              🚨 Kritik Loq
              {alertLogCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {alertLogCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-metro-panel2/60 px-3 py-1.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-metro-panel2"
            >
              Çıxış
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        {trains.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {trains.map((train) => (
              <TrainCard
                key={train.train_id}
                train={train}
                onClick={() => setSelectedTrainId(train.train_id)}
              />
            ))}
          </div>
        )}
      </main>

      <TrainDetailModal
        train={selectedTrain}
        onClose={() => setSelectedTrainId(null)}
      />
    </div>
  );
}

function TrainCard({
  train,
  onClick,
}: {
  train: TrainUpdate;
  onClick: () => void;
}) {
  const avg = averageDensity(train);
  return (
    <motion.article
      key={`${train.train_id}-${train.timestamp}`}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, scale: [1.0, 1.02, 1.0] }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title="Ətraflı bax"
      className="group cursor-pointer rounded-xl bg-metro-panel/80 p-4 shadow-lg ring-1 ring-white/5 transition-shadow hover:ring-metro-accent/40 hover:shadow-2xl"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{train.train_id}</h2>
          <p className="text-[11px] text-slate-400">
            {train.current_station} → {train.next_station}
          </p>
          <p className="text-[10px] text-slate-500">
            Updated {formatTimestamp(train.timestamp)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            Avg
          </div>
          <div className="text-lg font-bold tabular-nums text-white">
            {avg.toFixed(0)}
            <span className="ml-0.5 text-xs text-slate-400">%</span>
          </div>
        </div>
      </header>
      <TrainSilhouette wagons={train.wagons} size="sm" />
    </motion.article>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-metro-panel2/60 px-3 py-1.5 ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-widest text-slate-400">
        {label}
      </div>
      <div className={`text-base font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-24 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
      <div className="text-4xl">🚇</div>
      <p className="text-lg font-semibold text-slate-200">Waiting for data…</p>
      <p className="text-sm">
        Make sure the backend and generator services are running.
      </p>
    </div>
  );
}
