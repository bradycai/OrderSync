import { useEffect, useState } from "react";
import { Sidebar, type View } from "./components/Sidebar";
import { Icon } from "./components/Icon";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { Timing } from "./pages/Timing";
import { useStore } from "./store";
const titles: Record<View, string> = {
  overview: "Overview",
  inventory: "Inventory",
  intake: "Email intake",
  attention: "Needs attention",
  timing: "Demo timer",
};
export function App() {
  const [view, setView] = useState<View>("overview");
  const [demoMode, setDemoMode] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const { resetDemo, now } = useStore();
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setDemoMode(s.demoMode !== false))
      .catch(() => setDemoMode(true));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="shell">
      <Sidebar
        view={view}
        onNavigate={navigate}
        onReset={() => {
          resetDemo();
          setResetKey((k) => k + 1);
          navigate("overview");
          setNotice("Demo reset. You're back to the original sample data.");
        }}
      />
      <main className="main" id="main-content">
        <div className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{titles[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-indicator">
              <span />
              Demo workspace
            </span>
            <span className="topbar-date">
              <Icon name="calendar" size={15} />
              {now.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div key={resetKey}>
          {view === "overview" && <Overview onNavigate={navigate} />}
          {view === "intake" && <Intake onNavigate={navigate} />}
          {view === "attention" && <Attention />}
          {view === "inventory" && <Inventory />}
          {view === "timing" && <Timing />}
        </div>
        <footer className="app-footer">
          <span>
            <span className="footer-dot" />
            All sample data. All external actions are simulated.
          </span>
          <span>
            {demoMode
              ? "AI demo mode · prepared sample outputs"
              : "AI assistance enabled"}
          </span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
