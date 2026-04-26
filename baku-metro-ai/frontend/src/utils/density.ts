import type { WagonStatus } from "@/types/metro";
import { TOTAL_SEATS_PER_WAGON } from "@/constants";

/** Tailwind classes per status — kept in one place to avoid drift across views. */
export const STATUS_BG: Record<WagonStatus, string> = {
  Green: "bg-emerald-500",
  Yellow: "bg-amber-400",
  Red: "bg-red-600",
};

export const STATUS_TEXT: Record<WagonStatus, string> = {
  Green: "text-emerald-400",
  Yellow: "text-amber-300",
  Red: "text-red-400",
};

export const STATUS_RING: Record<WagonStatus, string> = {
  Green: "ring-emerald-400/40",
  Yellow: "ring-amber-300/40",
  Red: "ring-red-400/40",
};

/** Bilingual labels (AZ / EN) for the kiosk view. */
export const STATUS_LABEL_AZ: Record<WagonStatus, string> = {
  Green: "BOŞ",
  Yellow: "ORTA",
  Red: "DOLU",
};

export const STATUS_LABEL_EN: Record<WagonStatus, string> = {
  Green: "Empty",
  Yellow: "Moderate",
  Red: "Full",
};

/** Estimated empty seats. 0% density → 40 empty, 100% → 0 empty. */
export function getEmptySeats(density: number): number {
  const occupied = Math.round((density / 100) * TOTAL_SEATS_PER_WAGON);
  return Math.max(0, TOTAL_SEATS_PER_WAGON - occupied);
}

export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
