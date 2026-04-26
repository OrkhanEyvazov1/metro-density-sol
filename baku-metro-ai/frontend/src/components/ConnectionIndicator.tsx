import type { ConnectionStatus } from "@/types/metro";

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
}

const COLORS: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400",
  open: "bg-emerald-500",
  closed: "bg-slate-500",
  error: "bg-red-500",
};

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  open: "Live",
  closed: "Offline",
  error: "Error",
};

export function ConnectionIndicator({ status }: ConnectionIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-metro-panel2/60 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/5">
      <span
        className={`relative inline-block h-2 w-2 rounded-full ${COLORS[status]}`}
      >
        {status === "open" && (
          <span className="absolute inset-0 inline-block animate-pulseDot rounded-full bg-emerald-400 opacity-75" />
        )}
      </span>
      {LABELS[status]}
    </div>
  );
}
