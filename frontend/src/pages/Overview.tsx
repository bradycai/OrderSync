import { CHANNELS, CHANNEL_LABELS, type OrderStatus } from "@orderwatch/shared";
import { ChannelBadge } from "../components/ChannelBadge";
import { StatTile } from "../components/StatTile";
import { useStore } from "../store";

const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_shipment: "Awaiting shipment",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function Overview() {
  const {
    orders, inventory, alerts, channelFilter, setChannelFilter, search, setSearch, loading,
  } = useStore();

  const awaiting = orders.filter((o) => o.status === "awaiting_shipment").length;
  const low = inventory.filter((r) => r.isLow || r.isShort).length;
  // Deadlines are evaluated server-side; reuse the alert set rather than re-deriving.
  const overdueKeys = new Set(
    alerts.filter((a) => a.kind === "overdue_shipment").flatMap((a) => a.relatedOrderKeys),
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Overview</h1>
        <p className="sub">Every channel in one place. Sample data.</p>
      </header>

      <section className="tiles">
        <StatTile label="Orders shown" value={orders.length} />
        <StatTile label="Awaiting shipment" value={awaiting} tone={awaiting ? "warn" : "neutral"} />
        <StatTile label="Products running low" value={low} tone={low ? "warn" : "neutral"} />
        <StatTile
          label="Needs attention"
          value={alerts.length}
          tone={alerts.length ? "critical" : "neutral"}
          note={alerts.length ? "Shortages and overdue orders" : "All clear"}
        />
      </section>

      <section className="toolbar">
        <div className="filters">
          <button
            className={channelFilter === "all" ? "chip active" : "chip"}
            onClick={() => setChannelFilter("all")}
          >
            All channels
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
        <input
          className="search"
          placeholder="Search order ID, customer, or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <table className="table">
        <thead>
          <tr>
            <th>Order</th><th>Customer</th><th>Product</th><th className="num">Qty</th>
            <th>Channel</th><th>Placed</th><th>Ship by</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) =>
            o.lines.map((line, i) => (
              <tr key={`${o.key}-${i}`}>
                <td className="mono">{i === 0 ? o.channelOrderId : ""}</td>
                <td>{i === 0 ? o.customerName : ""}</td>
                <td>
                  {line.listingTitle}
                  {line.matchStatus !== "matched" && (
                    <span className="pill pill-warn">match pending</span>
                  )}
                </td>
                <td className="num">{line.quantity}</td>
                <td>{i === 0 && <ChannelBadge channel={o.channel} />}</td>
                <td>{fmtDate(o.placedAt)}</td>
                <td className={overdueKeys.has(o.key) ? "overdue" : undefined}>
                  {fmtDate(o.shipBy)}
                </td>
                <td><span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
              </tr>
            )),
          )}
          {!loading && orders.length === 0 && (
            <tr><td colSpan={8} className="empty">No orders match that filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
