import { useEffect, useState } from "react";
import { Sidebar, type View } from "./components/Sidebar";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { Timing } from "./pages/Timing";

export function App() {
  const [view, setView] = useState<View>("overview");
  const [demoMode, setDemoMode] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setDemoMode(s.demoMode))
      .catch(() => setDemoMode(true));
  }, []);

  return (
    <div className="shell">
      <Sidebar view={view} onNavigate={setView} />
      <main className="main">
        <div className="banner">
          Sample data — no marketplace is connected. All sends and stock updates are simulated.
          {demoMode && <strong> AI demo mode: prepared sample outputs (no ANTHROPIC_API_KEY set).</strong>}
        </div>
        {view === "overview" && <Overview />}
        {view === "intake" && <Intake />}
        {view === "attention" && <Attention />}
        {view === "inventory" && <Inventory />}
        {view === "timing" && <Timing />}
      </main>
    </div>
  );
}
