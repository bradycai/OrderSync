import { useStore } from "../store";

export type View = "overview" | "inventory" | "intake" | "attention" | "timing";

const NAV: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Orders across all channels" },
  { id: "intake", label: "Import email", hint: "Paste an order notification" },
  { id: "attention", label: "Needs attention", hint: "Shortages and overdue orders" },
  { id: "inventory", label: "Inventory", hint: "Stock, committed, available" },
  { id: "timing", label: "Demo timer", hint: "Manual vs assisted" },
];

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const { alerts, resetDemo } = useStore();

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">OW</span>
        <div>
          <div className="brand-name">OrderWatch</div>
          <div className="brand-sub">Operations assistant</div>
        </div>
      </div>

      <ul className="nav">
        {NAV.map((item) => (
          <li key={item.id}>
            <button
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => onNavigate(item.id)}
              title={item.hint}
            >
              {item.label}
              {item.id === "attention" && alerts.length > 0 && (
                <span className="pill pill-critical">{alerts.length}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-foot">
        <button className="btn btn-ghost" onClick={resetDemo}>
          Reset demo
        </button>
        <p className="fine">All data is synthetic. All actions are simulated.</p>
      </div>
    </nav>
  );
}
