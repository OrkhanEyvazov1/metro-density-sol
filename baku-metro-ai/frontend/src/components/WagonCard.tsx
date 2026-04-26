import { motion } from "framer-motion";

import type { WagonData } from "@/types/metro";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import {
  STATUS_BG,
  STATUS_LABEL_AZ,
  STATUS_LABEL_EN,
  STATUS_RING,
  getEmptySeats,
} from "@/utils/density";

interface WagonCardProps {
  wagon: WagonData;
  size?: "sm" | "lg";
  showLabel?: boolean;
  highlight?: boolean;
}

/**
 * Reusable wagon card.
 *  - "sm" → AdminDashboard grid cell
 *  - "lg" → StationMonitor kiosk
 */
export function WagonCard({
  wagon,
  size = "sm",
  showLabel = false,
  highlight = false,
}: WagonCardProps) {
  // sm variant shows live density %; lg (kiosk) shows live empty-seat count.
  const animatedDensity = useAnimatedNumber(wagon.density, 0);
  const animatedSeats = useAnimatedNumber(getEmptySeats(wagon.density), 0);

  if (size === "sm") {
    return (
      <motion.div
        layout
        className={`relative flex h-16 flex-1 flex-col items-center justify-center rounded-md text-white ring-1 ring-inset transition-colors duration-500 ${STATUS_BG[wagon.status]} ${STATUS_RING[wagon.status]}`}
        animate={{ scale: highlight ? 1.04 : 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <span className="text-[10px] uppercase tracking-wider opacity-80">
          W{wagon.wagon_id}
        </span>
        <motion.span className="text-lg font-bold tabular-nums">
          <motion.span>{animatedDensity}</motion.span>
          <span className="ml-0.5 text-xs font-medium opacity-80">%</span>
        </motion.span>
      </motion.div>
    );
  }

  // ---------------- LARGE (kiosk) ----------------
  const fillHeight = `${Math.max(2, Math.min(100, wagon.density))}%`;
  return (
    <motion.div
      layout
      className={`relative flex h-full flex-col items-center justify-end overflow-hidden rounded-2xl bg-metro-panel2 p-6 shadow-xl ring-1 ${STATUS_RING[wagon.status]}`}
      animate={{ scale: highlight ? 1.02 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Animated fill bar */}
      <motion.div
        className={`absolute inset-x-0 bottom-0 ${STATUS_BG[wagon.status]} opacity-30`}
        initial={false}
        animate={{ height: fillHeight }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      <div className="relative z-10 flex h-full w-full flex-col justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Wagon
          </div>
          <div className="text-3xl font-bold text-white">{wagon.wagon_id}</div>
        </div>

        <div className="flex flex-col items-center justify-center pb-2">
          <motion.div className="text-7xl font-extrabold tabular-nums text-white drop-shadow">
            <motion.span>{animatedSeats}</motion.span>
          </motion.div>
          <div className="mt-1 text-center">
            <div className="text-sm font-semibold text-slate-200">boş yer</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              empty seats
            </div>
          </div>
          {showLabel && (
            <div className="mt-3 text-center">
              <div className="text-lg font-bold text-white">
                {STATUS_LABEL_AZ[wagon.status]}
              </div>
              <div className="text-xs uppercase tracking-widest text-slate-400">
                {STATUS_LABEL_EN[wagon.status]}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
