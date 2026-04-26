import { motion } from "framer-motion";

import type { WagonData } from "@/types/metro";
import { WagonCard } from "./WagonCard";

interface TrainSilhouetteProps {
  wagons: WagonData[];
  size?: "sm" | "lg";
  showLabels?: boolean;
  recommendedWagonId?: number;
  onClick?: () => void;
}

/**
 * Horizontal train silhouette: a "head" + a row of `WagonCard` segments.
 * Used by both the AdminDashboard (sm) and StationMonitor (lg) views.
 */
export function TrainSilhouette({
  wagons,
  size = "sm",
  showLabels = false,
  recommendedWagonId,
  onClick,
}: TrainSilhouetteProps) {
  const clickable = typeof onClick === "function";
  if (size === "sm") {
    return (
      <div
        className={`flex items-stretch gap-1 ${clickable ? "cursor-pointer" : ""}`}
        onClick={onClick}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <motion.div
          className="flex h-16 w-5 items-center justify-center rounded-l-full bg-slate-700/70 text-[9px] font-semibold text-slate-300"
          aria-hidden
        >
          ◀
        </motion.div>
        <div className="flex flex-1 gap-1">
          {wagons.map((wagon) => (
            <WagonCard
              key={wagon.wagon_id}
              wagon={wagon}
              size="sm"
              highlight={wagon.wagon_id === recommendedWagonId}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-stretch gap-3">
      <div className="flex w-16 items-center justify-center rounded-l-3xl bg-slate-800/70 text-2xl text-slate-400">
        ◀
      </div>
      <div className="grid flex-1 grid-cols-5 gap-3">
        {wagons.map((wagon) => (
          <WagonCard
            key={wagon.wagon_id}
            wagon={wagon}
            size="lg"
            showLabel={showLabels}
            highlight={wagon.wagon_id === recommendedWagonId}
          />
        ))}
      </div>
    </div>
  );
}
