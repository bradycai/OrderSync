import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Toasts } from "./components/Toasts";
import { Pill } from "./components/ui";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { Timing } from "./pages/Timing";
import { useStore } from "./store";

type AiStatus = { demoMode: boolean; reachable: boolean } | null;

export function App() {
  const { view } = useStore();
  const [ai, setAi] = useState<AiStatus>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setAi({ demoMode: Boolean(s.demoMode), reachable: true });
      })
      .catch(() => {
        // No API proxy running — the UI falls back to in-browser sample outputs.
        if (!cancelled) setAi({ demoMode: true, reachable: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-200 bg-white px-6 py-2.5">
          <p className="text-xs text-zinc-600">
            <span className="font-medium text-zinc-800">Prototype.</span> All data is
            synthetic and no marketplace is connected. Every send and stock update is
            simulated.
          </p>

          <div className="ml-auto flex items-center gap-2">
            {ai === null && <Pill tone="muted">checking AI status…</Pill>}
            {ai?.demoMode && (
              <Pill
                tone="amber"
                className={ai.reachable ? undefined : "cursor-help"}
              >
                <span
                  title={
                    ai.reachable
                      ? "The API proxy is running without an ANTHROPIC_API_KEY, so it returns prepared sample outputs."
                      : "The API proxy is not running, so the browser is using built-in sample outputs."
                  }
                >
                  Demo mode — prepared sample AI outputs
                  {!ai.reachable && " (API offline)"}
                </span>
              </Pill>
            )}
            {ai && !ai.demoMode && <Pill tone="emerald">Live model — claude-opus-5</Pill>}
          </div>
        </header>

        <main className="scroll-slim flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-6xl">
            {view === "overview" && <Overview />}
            {view === "intake" && <Intake />}
            {view === "attention" && <Attention />}
            {view === "inventory" && <Inventory />}
            {view === "timing" && <Timing />}
          </div>
        </main>
      </div>

      <Toasts />
    </div>
  );
}
