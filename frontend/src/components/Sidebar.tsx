import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../store";
import { CHANNELS, CHANNEL_LABELS } from "@orderwatch/shared";
import { Icon } from "./Icon";
import "./Sidebar.css";
export type View = "overview" | "inventory" | "intake" | "attention";
const NAV: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "intake", label: "Email intake" },
  { id: "attention", label: "Needs attention" },
];
export function Sidebar({
  view,
  onNavigate,
  onReset,
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
  view: View;
  onNavigate: (v: View) => void;
  onReset: () => void;
}) {
  const { alerts } = useStore();
  const { signOut } = useAuth();
  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
      <button className="sidebar-toggle" onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed} aria-controls="sidebar-navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
          <path d={collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
        </svg>
      </button>
      <a
        className="brand"
        aria-label="OrderWatch overview"
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("overview");
        }}
      >
        <span className="brand-mark">
          <Icon name="inventory" size={25} />
        </span>
        <span className="brand-name">
          OrderSync<span className="brand-dot">.</span>
        </span>
      </a>
      <div className="workspace">
        <span className="workspace-avatar">S</span>
        <div>
          <strong>Studio Supply</strong>
          <span>Founder workspace</span>
        </div>
        <span className="workspace-caret">⌄</span>
      </div>
      <nav id="sidebar-navigation" aria-label="Main navigation">
        <p className="nav-label">WORKSPACE</p>
        <ul className="nav">
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${view === item.id ? "active" : ""}`}
                title={item.label}
                aria-label={item.label}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon name={item.id} />
                <span className="nav-item-label">{item.label}</span>
                {item.id === "attention" && alerts.length > 0 && (
                  <span className="nav-count">{alerts.length}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-channels">
        <p className="nav-label">
          YOUR CHANNELS <span>4</span>
        </p>
        {CHANNELS.map((c) => (
          <div className="sidebar-channel" key={c}>
            <span className={`channel-symbol symbol-${c}`}>
              {c === "shopify"
                ? "S"
                : c === "tiktok"
                  ? "♪"
                  : c === "amazon"
                    ? "a"
                    : "e"}
            </span>
            {CHANNEL_LABELS[c]}
            <span className="channel-dot" />
          </div>
        ))}
        <p className="channel-caption">Sample channels · no live connections</p>
      </div>
      <div className="sidebar-foot">
        <button className="reset-button" title="Reset demo" aria-label="Reset demo" onClick={onReset}>
          <Icon name="reset" size={16} />
          <span className="sidebar-action-label">Reset demo</span>
        </button>
        <button className="reset-button" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}>
          <Icon name="arrow" size={16} />
          <span className="sidebar-action-label">Sign out</span>
        </button>
        <div className="profile">
          <span className="profile-avatar">SS</span>
          <div>
            <strong>Studio Supply</strong>
            <span>Demo workspace</span>
          </div>
          <span className="profile-dot" />
        </div>
      </div>
    </aside>
  );
}
