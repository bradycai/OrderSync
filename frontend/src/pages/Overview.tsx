import { useEffect, useState } from "react";
import { CHANNELS, CHANNEL_LABELS, type OrderStatus } from "@orderwatch/shared";
import { ChannelBadge } from "../components/ChannelBadge";
import { StatTile } from "../components/StatTile";
import { Icon } from "../components/Icon";
import type { View } from "../components/Sidebar";
import { api } from "../api";
import { useStore } from "../store";

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
    inventory,
    alerts,
    channelFilter,
    setChannelFilter,
    search,
    setSearch,
  } = useStore();
  const [status, setStatus] = useState("all");

  // `orders` is filtered server-side by channel + search, so the channel
  // breakdown needs its own unfiltered read to stay meaningful while a chip
  // is active.
  const [channelTotals, setChannelTotals] = useState<Record<string, number>>(
    {},
  );
  useEffect(() => {
    let cancelled = false;
    void api
      .orders({})
      .then(({ orders: all }) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const o of all) counts[o.channel] = (counts[o.channel] ?? 0) + 1;
        setChannelTotals(counts);
      })
      .catch(() => {
        // The store already surfaces API failures; the breakdown stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, [orders]);
  const totalOrders = Object.values(channelTotals).reduce((a, b) => a + b, 0);

  const awaiting = orders.filter((o) => o.status === "awaiting_shipment").length;
  const low = inventory.filter((r) => r.isLow || r.isShort).length;
  const shortage = inventory.find((r) => r.isShort);
  // Deadlines are evaluated server-side; reuse the alert set rather than
  // re-deriving "overdue" from a client clock.
  const overdueKeys = new Set(
    alerts
      .filter((a) => a.kind === "overdue_shipment")
      .flatMap((a) => a.relatedOrderKeys),
  );
  const filtered = orders.filter((o) => status === "all" || o.status === status);

  return (
    <div className="page overview-page">
      <header className="page-head head-with-action">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Operations overview</h1>
          <p className="sub">Orders, inventory, and alerts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate("intake")}>
          <Icon name="intake" size={17} />
          Import an email
          <Icon name="arrow" size={16} />
        </button>
      </header>
      <section className="tiles" aria-label="Operations summary">
        <StatTile
          label="Orders shown"
          value={orders.length}
          note={
            channelFilter === "all" && !search.trim()
              ? "Across 4 sales channels"
              : "Matching your current filters"
          }
          icon="box"
        />
        <StatTile
          label="Awaiting shipment"
          value={awaiting}
          tone={awaiting ? "warn" : "neutral"}
          note="Awaiting fulfillment"
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
          note={alerts.length ? "Requires review" : "No active alerts"}
          icon="attention"
        />
      </section>
      <div className="insights-grid">
        <section className="focus-card">
          <div className="focus-copy">
            <span className="section-kicker">
              <span className="attention-dot" />
              INVENTORY STATUS
            </span>
            <h2>
              {shortage
                ? "Stock shortage"
                : "Inventory is available."}
            </h2>
            <p>
              {shortage ? (
                <>
                  {shortage.title}, {shortage.color} / {shortage.size} has{" "}
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
              onClick={() => onNavigate(shortage ? "inventory" : "attention")}
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
              {shortage?.sku ?? "INVENTORY IN BALANCE"}
            </span>
          </div>
        </section>
        <section className="channel-card">
          <div className="section-title">
            <h2>Orders by channel</h2>
            <span className="fine">Sample data</span>
          </div>
          {CHANNELS.map((c) => {
            const count = channelTotals[c] ?? 0;
            return (
              <button
                key={c}
                className="channel-row"
                onClick={() => setChannelFilter(channelFilter === c ? "all" : c)}
                aria-pressed={channelFilter === c}
              >
                <ChannelBadge channel={c} />
                <span className="channel-meter">
                  <span
                    className={`meter-${c}`}
                    style={{
                      width: `${totalOrders ? (count / totalOrders) * 100 : 0}%`,
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
              Your orders <span className="count-label">{totalOrders}</span>
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
              All channels <span>{totalOrders}</span>
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
                  const overdue = overdueKeys.has(o.key);
                  return (
                    <tr key={`${o.key}-${i}`}>
                      <td className="mono order-id">
                        {i === 0 ? `#${o.channelOrderId}` : ""}
                      </td>
                      <td>
                        {i === 0 && (
                          <span className="customer-cell">
                            <span className={`customer-avatar avatar-${o.channel}`}>
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
                        <div className="product-title" title={line.listingTitle}>
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
                      <td className={overdue ? "overdue date-cell" : "date-cell"}>
                        {fmtDate(o.shipBy)}
                        {overdue && <span className="deadline-note">Overdue</span>}
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
            Showing {filtered.length} of {totalOrders} orders
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
          <b>3</b>Review &amp; approve
        </button>
        <span className="fine">You're always in control.</span>
      </div>
    </div>
  );
}
