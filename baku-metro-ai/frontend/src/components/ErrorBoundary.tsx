import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const INITIAL_STATE: ErrorBoundaryState = { hasError: false, error: null };

/**
 * Wraps top-level pages so a render-time crash does not blank the UI.
 *
 * On error: displays a localised retry screen and logs to the console.
 * No external reporting service is wired up (hackathon scope).
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = INITIAL_STATE;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  private handleReload = (): void => {
    this.setState(INITIAL_STATE);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center gradient-bg px-6 text-center">
        <div className="max-w-md rounded-2xl bg-metro-panel/80 p-8 shadow-2xl ring-1 ring-white/10">
          <div className="text-4xl" aria-hidden>
            ⚠️
          </div>
          <h1 className="mt-3 text-xl font-bold text-white">
            Xəta baş verdi. Yenidən cəhd edin.
          </h1>
          {this.state.error && (
            <p className="mt-2 break-words font-mono text-xs text-slate-400">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg bg-metro-accent px-5 py-2 text-sm font-semibold text-slate-900 transition hover:brightness-110"
          >
            Yenidən yüklə
          </button>
        </div>
      </div>
    );
  }
}
