import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg px-6">
      <div className="w-full max-w-2xl rounded-2xl bg-metro-panel/80 p-10 text-center shadow-2xl ring-1 ring-white/5">
        <div className="text-5xl">🚇</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          Baku Metro AI
        </h1>
        <p className="mt-2 text-slate-300">
          Real-time passenger density monitoring system
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/admin"
            className="rounded-xl bg-metro-accent/20 px-6 py-5 text-left ring-1 ring-metro-accent/40 transition hover:bg-metro-accent/30"
          >
            <div className="text-xs uppercase tracking-widest text-metro-accent">
              Operator
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              Admin Dashboard →
            </div>
            <p className="mt-1 text-xs text-slate-400">
              All trains and wagons at a glance
            </p>
          </Link>
          <Link
            to="/station?train=Train-1"
            className="rounded-xl bg-emerald-500/15 px-6 py-5 text-left ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
          >
            <div className="text-xs uppercase tracking-widest text-emerald-300">
              Kiosk
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              Station Monitor →
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Single train, full-screen passenger view
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
