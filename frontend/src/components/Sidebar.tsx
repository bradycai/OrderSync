import { useAuth } from "../auth/AuthProvider";
import { useStore } from "../store";
import { CHANNELS, CHANNEL_LABELS } from "@orderwatch/shared";
import { Icon } from "./Icon";
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
  onToggleCollapse,
}: {
  view: View;
  onNavigate: (v: View) => void;
  onReset: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { alerts } = useStore();
  const { signOut } = useAuth();
  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
      <div className="sidebar-head">
        <a
          className="brand"
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
            orderwatch<span className="brand-dot">.</span>
          </span>
        </a>
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
        </button>
      </div>
      <div className="workspace" title={collapsed ? "Studio Supply" : undefined}>
        <span className="workspace-avatar">S</span>
        <div>
          <strong>Studio Supply</strong>
          <span>Founder workspace</span>
        </div>
        <span className="workspace-caret">⌄</span>
      </div>
      <nav aria-label="Main navigation">
        <p className="nav-label">WORKSPACE</p>
        <ul className="nav">
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${view === item.id ? "active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.id} />
                <span>{item.label}</span>
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
          <div
            className="sidebar-channel"
            key={c}
            title={collapsed ? CHANNEL_LABELS[c] : undefined}
          >
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
        <div className="demo-card">
          <Icon name="spark" />
          <strong>A little help. A clearer day.</strong>
          <p>
            Your operations, in one place.
            <br />
            Explore with sample data.
          </p>
          <button
            onClick={() => onNavigate("intake")}
            title={collapsed ? "Try the demo flow" : undefined}
          >
            Try the demo flow <Icon name="arrow" size={16} />
          </button>
        </div>
        <button
          className="reset-button"
          onClick={onReset}
          title={collapsed ? "Reset demo" : undefined}
        >
          <Icon name="reset" size={16} />
          Reset demo
        </button>
        <button
          className="reset-button"
          onClick={() => void signOut()}
          title={collapsed ? "Sign out" : undefined}
        >
          <Icon name="arrow" size={16} />
          Sign out
        </button>
        <div className="profile" title={collapsed ? "Studio Supply" : undefined}>
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
