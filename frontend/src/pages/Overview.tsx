import { useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { StatTile } from "../components/StatTile";
import { Icon } from "../components/Icon";
import type { View } from "../components/Sidebar";
import { isLow } from "../lib/inventory";
import { useStore } from "../store";
import { CHANNELS, CHANNEL_LABELS, type OrderStatus } from "../types";
const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_shipment: "Awaiting shipment",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export function Overview({ onNavigate }: { onNavigate: (v: View) => void }) {
  const {
    orders,
    products,
    snapshots,
    alerts,
    visibleOrders,
    channelFilter,
    setChannelFilter,
    search,
    setSearch,
    now,
  } = useStore();
  const [status, setStatus] = useState("all");
  const awaiting = orders.filter(
    (o) => o.status === "awaiting_shipment",
  ).length;
  const low = snapshots.filter(isLow).length;
  const shortage = snapshots.find((s) => s.available < 0);
  const shortageProduct = products.find((p) => p.sku === shortage?.sku);
  const filtered = visibleOrders.filter(
    (o) => status === "all" || o.status === status,
  );
  return (
    <div className="page overview-page">
      <header className="page-head head-with-action">
        <div>
          <p className="eyebrow">YOUR DAILY OPERATIONS, AT A GLANCE</p>
          <h1>A clear view. A calmer day.</h1>
          <p className="sub">
            All your orders, inventory, and next steps. Right here.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => onNavigate("intake")}
        >
          <Icon name="intake" size={17} />
          Import an email
          <Icon name="arrow" size={16} />
        </button>
      </header>
      <section className="tiles" aria-label="Operations summary">
        <StatTile
          label="Total orders"
          value={orders.length}
          note="Across 4 sales channels"
          icon="box"
        />
        <StatTile
          label="Awaiting shipment"
          value={awaiting}
          note="Ready for your next move"
          icon="intake"
        />
        <StatTile
          label="Products running low"
          value={low}
          tone={low ? "warn" : "neutral"}
          note="Available stock below 3 units"
          icon="inventory"
        />
        <StatTile
          label="Needs attention"
          value={alerts.length}
          tone={alerts.length ? "critical" : "neutral"}
          note={
            alerts.length ? "Let's get these sorted" : "You're all caught up"
          }
          icon="attention"
        />
      </section>
      <div className="insights-grid">
        <section className="focus-card">
          <div className="focus-copy">
            <span className="section-kicker">
              <span className="attention-dot" />
              ON YOUR RADAR
            </span>
            <h2>
              {shortage
                ? "One product. A few too many orders."
                : "Your stock is keeping up."}
            </h2>
            <p>
              {shortage ? (
                <>
                  {shortageProduct?.title}, {shortageProduct?.color} /{" "}
                  {shortageProduct?.size} has{" "}
                  <strong>{shortage.committed} units committed</strong> across{" "}
                  {shortage.contributingOrderKeys.length} orders, with only{" "}
                  {shortage.startingStock} in stock.
                </>
              ) : (
                "No inventory shortages right now. Check your attention queue for upcoming fulfillment tasks."
              )}
            </p>
            <button
              className="text-button"
              onClick={() => onNavigate("attention")}
            >
              {shortage ? "Review shortage" : "Review next steps"}
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <div className="stock-visual">
            <div className="garment" aria-hidden="true">
              <svg viewBox="0 0 120 120" fill="none">
                <path
                  d="m42 30-20 9-15 36 20 9 12-23v45h43V61l12 23 19-9-15-36-20-9c0-23-36-23-36 0Z"
                  fill="#2c3d33"
                  stroke="#17271f"
                  strokeWidth="2"
                />
                <path
                  d="M42 30q18 24 36 0M49 36v22m22-22v22M46 79h29l6 15H40l6-15Z"
                  stroke="#718174"
                  strokeWidth="2"
                />
                <path
                  d="M49 29c0-14 22-14 22 0"
                  stroke="#718174"
                  strokeWidth="3"
                />
              </svg>
            </div>
            {shortage && (
              <span className="shortage-label">
                {Math.abs(shortage.available)} unit
                {shortage.available < -1 ? "s" : ""} short
              </span>
            )}
            <span className="stock-caption">
              {shortageProduct?.sku ?? "INVENTORY IN BALANCE"}
            </span>
          </div>
        </section>
        <section className="channel-card">
          <div className="section-title">
            <h2>Across your channels</h2>
            <span className="fine">Sample data</span>
          </div>
          {CHANNELS.map((c) => {
            const count = orders.filter((o) => o.channel === c).length;
            return (
              <button
                key={c}
                className="channel-row"
                onClick={() =>
                  setChannelFilter(channelFilter === c ? "all" : c)
                }
                aria-pressed={channelFilter === c}
              >
                <ChannelBadge channel={c} />
                <span className="channel-meter">
                  <span
                    className={`meter-${c}`}
                    style={{
                      width: `${orders.length ? (count / orders.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <strong>{String(count).padStart(2, "0")}</strong>
                <span className="fine">orders</span>
              </button>
            );
          })}
        </section>
      </div>
      <section className="orders-panel" aria-label="Orders">
        <div className="orders-heading">
          <div>
            <h2>
              Your orders <span className="count-label">{orders.length}</span>
            </h2>
            <p>A single home for every sale.</p>
          </div>
          <span className="sample-label">
            <span />
            SAMPLE DATA
          </span>
        </div>
        <div className="toolbar">
          <div className="filters">
            <button
              className={channelFilter === "all" ? "chip active" : "chip"}
              onClick={() => setChannelFilter("all")}
            >
              All channels <span>{orders.length}</span>
            </button>
            {CHANNELS.map((c) => (
              <button
                key={c}
                className={channelFilter === c ? "chip active" : "chip"}
                onClick={() => setChannelFilter(c)}
              >
                {CHANNEL_LABELS[c]}
              </button>
            ))}
          </div>
          <label className="status-filter">
            <span className="sr-only">Filter by fulfillment status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="order-search">
          <Icon name="search" size={17} />
          <input
            placeholder="Search orders, customers, or products..."
            aria-label="Search orders, customers, or products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search">
              ×
            </button>
          )}
          <span>{filtered.length} orders</span>
        </label>
        <div className="table-scroll">
          <table className="table orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Product / listing</th>
                <th className="num">Qty</th>
                <th>Channel</th>
                <th>Placed</th>
                <th>Ship by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) =>
                o.lines.map((line, i) => {
                  const overdue =
                    o.status === "awaiting_shipment" &&
                    new Date(o.shipBy) < now;
                  return (
                    <tr key={`${o.key}-${i}`}>
                      <td className="mono order-id">
                        {i === 0 ? `#${o.channelOrderId}` : ""}
                      </td>
                      <td>
                        {i === 0 && (
                          <span className="customer-cell">
                            <span
                              className={`customer-avatar avatar-${o.channel}`}
                            >
                              {o.customerName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            {o.customerName}
                          </span>
                        )}
                      </td>
                      <td>
                        <div
                          className="product-title"
                          title={line.listingTitle}
                        >
                          {line.listingTitle}
                        </div>
                        <span className="fine">
                          {line.matchStatus === "matched"
                            ? line.sku
                            : "Product match pending review"}
                        </span>
                      </td>
                      <td className="num">{line.quantity}</td>
                      <td>{i === 0 && <ChannelBadge channel={o.channel} />}</td>
                      <td className="date-cell">{fmtDate(o.placedAt)}</td>
                      <td
                        className={overdue ? "overdue date-cell" : "date-cell"}
                      >
                        {fmtDate(o.shipBy)}
                        {overdue && (
                          <span className="deadline-note">Overdue</span>
                        )}
                      </td>
                      <td>
                        <span className={`status status-${o.status}`}>
                          {STATUS_LABEL[o.status]}
                        </span>
                      </td>
                    </tr>
                  );
                }),
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    <Icon name="search" />
                    <p>No orders match these filters.</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                        setChannelFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {orders.length} orders
          </span>
          <span>
            <Icon name="check" size={14} />
            Duplicates are matched by channel + order ID
          </span>
        </div>
      </section>
      <div className="flow-strip">
        <span>
          <Icon name="spark" size={17} />
          <strong>Meet your new workflow</strong>
        </span>
        <button onClick={() => onNavigate("intake")}>
          <b>1</b>Import an email
        </button>
        <Icon name="arrow" size={14} />
        <button onClick={() => onNavigate("attention")}>
          <b>2</b>Inspect an issue
        </button>
        <Icon name="arrow" size={14} />
        <button onClick={() => onNavigate("attention")}>
          <b>3</b>Review & approve
        </button>
        <span className="fine">You're always in control.</span>
      </div>
    </div>
  );
}
