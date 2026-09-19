import { useEffect, useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { Sidebar, type View } from "./components/Sidebar";
import { Attention } from "./pages/Attention";
import { Intake } from "./pages/Intake";
import { Inventory } from "./pages/Inventory";
import { Overview } from "./pages/Overview";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";
import { Timing } from "./pages/Timing";

export function App() {
  const { status } = useAuth();
  const [view, setView] = useState<View>("overview");
  const [authView, setAuthView] = useState<"signin" | "signup">("signin");
  const [demoMode, setDemoMode] = useState<boolean | null>(null);

  // /api/status is public, but there is nothing to show until the user is in.
  useEffect(() => {
    if (status !== "authed") return;

    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => setDemoMode(s.demoMode))
      .catch(() => setDemoMode(true));
  }, [status]);

  // Blank rather than the sign-in page, so a restored session does not flash it.
  if (status === "loading") return <div className="auth-shell" />;

  if (status === "anon") {
    return authView === "signin" ? (
      <SignIn onSwitch={() => setAuthView("signup")} />
    ) : (
      <SignUp onSwitch={() => setAuthView("signin")} />
    );
  }

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
