import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import {
  DEFAULT_STATION_NAME,
  DENSITY_THRESHOLDS,
  PHASE_A_STEPS,
  STATION_LIST,
} from "@/constants";
import { useMetroSocket } from "@/hooks/useMetroSocket";
import { useStationFilter } from "@/hooks/useStationFilter";
import type { TrainUpdate, WagonData } from "@/types/metro";
import { getEmptySeats } from "@/utils/density";

/** Each generator transit step (Phase A) is one second long. */
const SECONDS_PER_TRANSITION_STEP = 1;
/** Wagon display order on the kiosk: VAQON 5 (rear) → VAQON 1 (front). */
const WAGON_DISPLAY_IDS = [5, 4, 3, 2, 1] as const;
/** Linear 1-second motion to match the generator's POST cadence. */
const ARRIVAL_TRANSITION = { ease: "linear", duration: 1 } as const;
/** Vertical fill bar inside each wagon card animates with this curve. */
const FILL_TRANSITION = { duration: 0.8, ease: "easeInOut" } as const;

type DensityLabelAz = "BOŞ" | "ORTA" | "DOLU";
type DensityLabelEn = "Empty" | "Moderate" | "Full";

interface DensityStyle {
  label: DensityLabelAz;
  labelEn: DensityLabelEn;
  fill: string; // tailwind bg-* on the rising fill bar
  swatch: string; // tailwind bg-* on the legend swatch
  glow: string; // tailwind ring-* on the wagon card
}

const DENSITY_GREEN: DensityStyle = {
  label: "BOŞ",
  labelEn: "Empty",
  fill: "bg-emerald-500",
  swatch: "bg-emerald-500",
  glow: "ring-emerald-500/30",
};
const DENSITY_YELLOW: DensityStyle = {
  label: "ORTA",
  labelEn: "Moderate",
  fill: "bg-amber-400",
  swatch: "bg-amber-400",
  glow: "ring-amber-400/30",
};
const DENSITY_RED: DensityStyle = {
  label: "DOLU",
  labelEn: "Full",
  fill: "bg-red-500",
  swatch: "bg-red-500",
  glow: "ring-red-500/40",
};

function densityStyle(density: number): DensityStyle {
  if (density < DENSITY_THRESHOLDS.GREEN) return DENSITY_GREEN;
  if (density <= DENSITY_THRESHOLDS.YELLOW) return DENSITY_YELLOW;
  return DENSITY_RED;
}

function isKnownStation(name: string): boolean {
  return (STATION_LIST as readonly string[]).includes(name);
}

/**
 * Convert a fractional `arrival_progress` into a passenger-facing minute
 * countdown, using the generator's 10-step transit phase.
 *
 * - `progress >= 1` → 0 (arrived).
 * - Otherwise: ceil(remaining_seconds / 60), with a minimum of 1 minute
 *   so the kiosk does not flash "0 DƏQ" for the entire transit phase.
 */
function arrivalMinutes(progress: number): number {
  if (progress >= 1) return 0;
  const remainingSteps = (1 - progress) * PHASE_A_STEPS;
  const remainingSeconds = remainingSteps * SECONDS_PER_TRANSITION_STEP;
  return Math.max(1, Math.ceil(remainingSeconds / 60));
}

/**
 * Station-fixed kiosk view (V3).
 *
 * URL: `/station?name=<station name>`. Watches the live SystemState and
 * displays exactly one approaching/dwelling train at a time. When the
 * displayed train completes its cycle and a new train enters Phase A
 * toward this station, the React tree snaps to the new train (no
 * cross-fade) — its wagon fill bars then animate naturally to the new
 * densities via Framer Motion.
 */
export default function StationMonitor(): JSX.Element {
  const [params] = useSearchParams();
  const requested = params.get("name");
  const stationName =
    requested && isKnownStation(requested) ? requested : DEFAULT_STATION_NAME;

  const { data } = useMetroSocket();
  const train = useStationFilter(data, stationName);

  return (
    <div className="flex min-h-screen w-full flex-col gap-5 bg-[#0a0a0f] px-6 py-5 text-white">
      <RouteHeader stationName={stationName} train={train} />
      <Legend />
      <WagonGrid train={train} />
    </div>
  );
}

interface RouteHeaderProps {
  stationName: string;
  train: TrainUpdate | null;
}

/** Top route-and-arrival panel. Shows current → THIS station and ÇATMA VAXI. */
function RouteHeader({ stationName, train }: RouteHeaderProps): JSX.Element {
  if (!train) {
    return (
      <header className="rounded-2xl bg-metro-panel/70 px-7 py-6 ring-1 ring-white/5">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
          {stationName}
        </div>
        <div className="mt-2">
          <div className="text-3xl font-bold text-slate-200">
            Növbəti qatar gözlənilir…
          </div>
          <div className="mt-1 text-sm font-medium text-slate-500">
            Waiting for next train…
          </div>
        </div>
      </header>
    );
  }

  const minutes = arrivalMinutes(train.arrival_progress);

  return (
    <header className="rounded-2xl bg-metro-panel/70 px-7 py-6 ring-1 ring-white/5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <RouteLabels
          currentStation={train.current_station}
          nextStation={train.next_station}
        />
        <ArrivalCountdown minutes={minutes} />
      </div>
      <ProgressTrack progress={train.arrival_progress} />
    </header>
  );
}

interface RouteLabelsProps {
  currentStation: string;
  nextStation: string;
}

function RouteLabels({
  currentStation,
  nextStation,
}: RouteLabelsProps): JSX.Element {
  return (
    <div className="flex items-center gap-4 text-left">
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
          Hazırkı stansiya
        </div>
        <div className="text-2xl font-medium text-slate-200">
          {currentStation}
        </div>
      </div>
      <div className="text-3xl font-bold text-blue-400">→</div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.3em] text-blue-300">
          Növbəti stansiya
        </div>
        <div className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
          {nextStation}
        </div>
      </div>
    </div>
  );
}

interface ArrivalCountdownProps {
  minutes: number;
}

function ArrivalCountdown({ minutes }: ArrivalCountdownProps): JSX.Element {
  const arrived = minutes <= 0;
  return (
    <div className="text-right">
      <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
        Çatma Vaxtı
      </div>
      {arrived ? (
        <div>
          <div className="text-5xl font-extrabold leading-none text-blue-400 sm:text-6xl">
            ÇATDI
          </div>
          <div className="mt-1 text-sm font-medium text-slate-400">
            Arrived
          </div>
        </div>
      ) : (
        <>
          <div className="text-5xl font-extrabold leading-none text-blue-400 tabular-nums sm:text-6xl">
            {minutes}
          </div>
          <div className="mt-1 text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
            Dəq
          </div>
        </>
      )}
    </div>
  );
}

interface ProgressTrackProps {
  progress: number;
}

/** Horizontal progress track with a moving 🚇 icon (linear 1s tween). */
function ProgressTrack({ progress }: ProgressTrackProps): JSX.Element {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative mt-6 h-7">
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-700/60">
        <motion.div
          className="h-full origin-left rounded-full bg-blue-500"
          style={{ width: "100%" }}
          initial={false}
          animate={{ scaleX: clamped }}
          transition={ARRIVAL_TRANSITION}
        />
      </div>
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-base text-slate-400">
        ●
      </span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-base text-blue-400">
        ○
      </span>
      <motion.div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl"
        initial={false}
        animate={{ left: `${clamped * 100}%` }}
        transition={ARRIVAL_TRANSITION}
        aria-hidden
      >
        🚇
      </motion.div>
    </div>
  );
}

/** Right-aligned status legend shown above the wagon grid. */
function Legend(): JSX.Element {
  const items: { style: DensityStyle }[] = [
    { style: DENSITY_GREEN },
    { style: DENSITY_YELLOW },
    { style: DENSITY_RED },
  ];
  return (
    <div className="flex justify-end gap-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
      {items.map(({ style }) => (
        <div key={style.label} className="flex items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-sm ${style.swatch}`} />
          <span>{style.label}</span>
          <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500">
            {style.labelEn}
          </span>
        </div>
      ))}
    </div>
  );
}

interface WagonGridProps {
  train: TrainUpdate | null;
}

function WagonGrid({ train }: WagonGridProps): JSX.Element {
  const wagonsById = new Map<number, WagonData>(
    train ? train.wagons.map((w) => [w.wagon_id, w] as const) : []
  );

  return (
    <section className="grid flex-1 grid-cols-5 gap-3">
      {WAGON_DISPLAY_IDS.map((id) => {
        const wagon = wagonsById.get(id);
        return (
          <WagonFillCard
            key={`${train?.train_id ?? "none"}-${id}`}
            wagonId={id}
            wagon={wagon}
          />
        );
      })}
    </section>
  );
}

interface WagonFillCardProps {
  wagonId: number;
  /** Undefined → empty waiting state (gray outline). */
  wagon: WagonData | undefined;
}

/**
 * Returns the head/tail rounding style for the front/rear wagons.
 *
 * Layout reminder: the kiosk grid renders VAQON 5 … VAQON 1 left-to-right,
 * so the *outer* top corners (top-left of VAQON 5, top-right of VAQON 1)
 * are rounded to 40% — mirroring each other like the nose of a train.
 * Middle wagons keep the default `rounded-lg` on every corner.
 */
function headTailStyle(wagonId: number): CSSProperties {
  if (wagonId === 5) {
    return { borderTopLeftRadius: "40%" };
  }
  if (wagonId === 1) {
    return { borderTopRightRadius: "40%" };
  }
  return {};
}

function WagonFillCard({ wagonId, wagon }: WagonFillCardProps): JSX.Element {
  const cornerStyle = headTailStyle(wagonId);
  const suffix = wagonId === 1 ? " (BAŞ)" : wagonId === 5 ? " (SON)" : "";

  if (!wagon) {
    return (
      <div className="flex flex-col">
        <div
          className="relative flex-1 overflow-hidden rounded-lg bg-metro-panel/40 ring-1 ring-white/5"
          style={cornerStyle}
        />
        <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          Vaqon {wagonId}
          {suffix}
        </div>
      </div>
    );
  }

  const style = densityStyle(wagon.density);
  const fillPct = Math.max(0, Math.min(100, wagon.density));
  const emptySeats = getEmptySeats(wagon.density);

  return (
    <div className="flex flex-col">
      <div
        className={`relative flex-1 min-h-[260px] overflow-hidden rounded-lg bg-metro-panel/60 ring-1 ${style.glow}`}
        style={cornerStyle}
      >
        <motion.div
          className={`absolute inset-x-0 bottom-0 ${style.fill} opacity-80`}
          initial={false}
          animate={{ height: `${fillPct}%` }}
          transition={FILL_TRANSITION}
        />
        <div className="relative flex h-full flex-col items-center justify-center px-2 text-center">
          <div className="text-5xl font-extrabold leading-none text-white drop-shadow sm:text-6xl">
            {emptySeats}
          </div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-widest text-white/90">
            boş yer
          </div>
          <div className="text-[10px] font-medium normal-case tracking-normal text-white/60">
            empty seats
          </div>
          <div className="mt-3 flex flex-col items-center gap-0.5 rounded-xl bg-black/40 px-3 py-1 text-white/90">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em]">
              {style.label}
            </span>
            <span className="text-[9px] font-medium text-white/60">
              {style.labelEn}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
        Vaqon {wagonId}
        {suffix}
      </div>
    </div>
  );
}
