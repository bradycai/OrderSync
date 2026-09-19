import { useState } from "react";
import { Sidebar, type View } from "./components/Sidebar";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { Timing } from "./pages/Timing";
import { useStore } from "./store";

export function App() {
  const { status } = useAuth();
  const [view, setView] = useState<View>("overview");
  const { demoMode, loading, error } = useStore();

  return (
    <div className="shell">
      <Sidebar view={view} onNavigate={setView} />
      <main className="main">
        <div className="banner">
          Sample data — no marketplace is connected. All sends and stock updates are simulated.
          {demoMode && (
            <strong> AI demo mode: prepared sample outputs (no ANTHROPIC_API_KEY set).</strong>
          )}
        </div>
        {error && <div className="banner banner-error">{error}</div>}
        {loading && <div className="page"><p className="empty">Loading…</p></div>}
        {!loading && (
          <>
            {view === "overview" && <Overview />}
            {view === "intake" && <Intake />}
            {view === "attention" && <Attention />}
            {view === "inventory" && <Inventory />}
            {view === "timing" && <Timing />}
          </>
        )}
      </main>
    </div>
  );
}
