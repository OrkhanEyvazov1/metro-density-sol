import { motion } from "framer-motion";

interface RouteProgressBarProps {
  currentStation: string;
  nextStation: string;
  /** 0.0 (just left current) → 1.0 (arrived at next). */
  progress: number;
  /** "kiosk" = full-bleed Station Monitor; "compact" = inside modal. */
  variant?: "kiosk" | "compact";
}

/**
 * Animated route strip: two station labels, a connecting line, and a metro
 * icon that slides smoothly along based on `progress`. Reused by the kiosk
 * top bar and the train detail modal.
 */
export function RouteProgressBar({
  currentStation,
  nextStation,
  progress,
  variant = "kiosk",
}: RouteProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const isKiosk = variant === "kiosk";
  const heightClass = isKiosk ? "h-[120px]" : "h-20";
  const railHeight = isKiosk ? "h-[4px]" : "h-[3px]";
  const iconSize = isKiosk ? "text-3xl" : "text-xl";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl bg-metro-panel/70 px-6 py-3 ring-1 ring-white/5 ${heightClass}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Hazırkı stansiya
          </div>
          <div
            className={`font-semibold text-slate-300 ${isKiosk ? "text-xl" : "text-base"}`}
          >
            {currentStation}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.25em] text-metro-accent">
            Növbəti stansiya
          </div>
          <div
            className={`font-extrabold text-white ${isKiosk ? "text-2xl" : "text-lg"}`}
          >
            {nextStation}
          </div>
        </div>
      </div>

      {/* Rail + endpoints + train */}
      <div className="relative mt-3">
        <div
          className={`relative w-full rounded-full bg-slate-700/60 ${railHeight}`}
        >
          <motion.div
            className={`absolute left-0 top-0 rounded-full bg-metro-accent ${railHeight}`}
            initial={false}
            animate={{ width: `${clamped * 100}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>

        {/* Endpoint dots */}
        <span className="absolute left-0 top-1/2 -translate-y-1/2">
          <span className="block h-3 w-3 animate-pulseDot rounded-full bg-slate-400" />
        </span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">
          <span className="block h-3 w-3 animate-pulseDot rounded-full bg-metro-accent" />
        </span>

        {/* Moving train icon */}
        <motion.div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${iconSize}`}
          initial={false}
          animate={{ left: `${clamped * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
          aria-hidden
        >
          🚇
        </motion.div>
      </div>
    </div>
  );
}
