import { useEffect, useState } from "react";
import { DEMO_NOW } from "@orderwatch/shared";
import { useAuth } from "./auth/AuthProvider";
import { Sidebar, type View } from "./components/Sidebar";
import { Icon } from "./components/Icon";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { Timing } from "./pages/Timing";
import { StoreProvider, useStore } from "./store";

const SIDEBAR_KEY = "orderwatch.sidebar-collapsed";

const titles: Record<View, string> = {
  overview: "Overview",
  inventory: "Inventory",
  intake: "Email intake",
  attention: "Needs attention",
  timing: "Demo timer",
};

export function App() {
  const { status } = useAuth();
  const [authView, setAuthView] = useState<"signin" | "signup">("signin");

  if (status === "loading") return <div className="auth-shell" />;
  if (status === "anon") {
    return authView === "signin" ? (
      <SignIn onSwitch={() => setAuthView("signup")} />
    ) : (
      <SignUp onSwitch={() => setAuthView("signin")} />
    );
  }

  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}

function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_KEY) === "1",
  );
  const { resetDemo, demoMode, loading, error } = useStore();
  const now = DEMO_NOW;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={`shell${sidebarCollapsed ? " shell-collapsed" : ""}`}>
      <Sidebar
        view={view}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onReset={async () => {
          await resetDemo();
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
        {error && <div className="banner banner-error">{error}</div>}
        {loading && (
          <div className="page">
            <p className="empty">Loading…</p>
          </div>
        )}
        {!loading && (
          <div key={resetKey}>
            {view === "overview" && <Overview onNavigate={navigate} />}
            {view === "intake" && <Intake onNavigate={navigate} />}
            {view === "attention" && <Attention />}
            {view === "inventory" && <Inventory />}
            {view === "timing" && <Timing />}
          </div>
        )}
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
