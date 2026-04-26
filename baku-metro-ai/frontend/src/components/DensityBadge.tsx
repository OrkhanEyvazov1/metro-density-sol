import { motion } from "framer-motion";

import type { WagonStatus } from "@/types/metro";
import { STATUS_BG } from "@/utils/density";

interface DensityBadgeProps {
  status: WagonStatus;
  label?: string;
  className?: string;
}

export function DensityBadge({ status, label, className = "" }: DensityBadgeProps) {
  return (
    <motion.span
      layout
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow-sm ${STATUS_BG[status]} ${className}`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      {label ?? status}
    </motion.span>
  );
}
