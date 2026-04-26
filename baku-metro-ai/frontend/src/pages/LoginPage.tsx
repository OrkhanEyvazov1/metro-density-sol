import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useAnimationControls } from "framer-motion";

import { useAuth } from "@/contexts/AuthContext";

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from ?? "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controls = useAnimationControls();

  // If user is already authed, skip the form.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (login(username.trim(), password)) {
      setError(null);
      navigate(redirectTo, { replace: true });
    } else {
      setError("İstifadəçi adı və ya şifrə yanlışdır");
      await controls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        transition: { duration: 0.5 },
      });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg px-6">
      <motion.form
        onSubmit={handleSubmit}
        animate={controls}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-metro-panel/85 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl">🚇</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
            Baku Metro AI
          </h1>
          <p className="mt-1 text-sm text-slate-400">Admin Panel</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
            İstifadəçi adı
          </span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-lg bg-metro-panel2/80 px-4 py-2.5 text-white outline-none ring-1 ring-white/5 transition focus:ring-metro-accent"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-slate-400">
            Şifrə
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg bg-metro-panel2/80 px-4 py-2.5 text-white outline-none ring-1 ring-white/5 transition focus:ring-metro-accent"
          />
        </label>

        {error && (
          <motion.p
            key={error}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 text-center text-sm font-medium text-red-400"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-metro-accent px-6 py-2.5 text-base font-semibold text-slate-900 shadow-lg transition hover:brightness-110 active:scale-[0.99]"
        >
          Daxil ol
        </button>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Test: <span className="font-mono text-slate-400">admin / metro2025</span>
        </p>
      </motion.form>
    </div>
  );
}
