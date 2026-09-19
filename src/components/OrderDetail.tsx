import { ChannelBadge } from "./ChannelBadge";
import { Drawer } from "./Drawer";
import { StatusPill } from "./StatusPill";
import { Button, Callout, Kv, Pill, SampleTag } from "./ui";
import { deadlineLabel, fmtDateTime } from "../lib/format";
import { useStore } from "../store";
import { CHANNEL_LABELS } from "../types";

/** Detail view for a single order. Opened by clicking a row in Overview. */
export function OrderDetail() {
  const {
    orders,
    selectedOrderKey,
    selectOrder,
    openAlerts,
    handleUpdateOrderStatus,
    pushToast,
    now,
    setView,
    selectAlert,
  } = useStore();

  const order = orders.find((o) => o.key === selectedOrderKey) ?? null;
  if (!order) return null;

  const deadline = deadlineLabel(order.shipBy, now);
  const relatedAlerts = openAlerts.filter((a) => a.relatedOrderKeys.includes(order.key));
  const holdsStock = order.status === "awaiting_shipment";

  function markShipped() {
    if (!order) return;
    handleUpdateOrderStatus(order.key, "shipped");
    pushToast({
      tone: "simulated",
      title: "Marked as shipped",
      body: `${order.key} released its committed stock. No carrier or marketplace was contacted.`,
    });
  }

  function cancelOrder() {
    if (!order) return;
    handleUpdateOrderStatus(order.key, "canceled");
    pushToast({
      tone: "simulated",
      title: "Order canceled",
      body: `${order.key} no longer holds stock. Nothing was sent to ${CHANNEL_LABELS[order.channel]}.`,
    });
  }

  function reopenOrder() {
    if (!order) return;
    handleUpdateOrderStatus(order.key, "awaiting_shipment");
  }

  return (
    <Drawer
      open
      onClose={() => selectOrder(null)}
      title={
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm">{order.channelOrderId}</span>
          <ChannelBadge channel={order.channel} />
        </span>
      }
      subtitle={
        <span className="flex items-center gap-2">
          {order.customerName}
          {order.source === "seed" ? (
            <SampleTag />
          ) : (
            <Pill tone="indigo">imported from email</Pill>
          )}
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {holdsStock ? (
            <>
              <Button variant="primary" onClick={markShipped}>
                Mark as shipped
              </Button>
              <Button variant="secondary" onClick={cancelOrder}>
                Cancel order
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={reopenOrder}>
              Reopen as awaiting shipment
            </Button>
          )}
          <span className="ml-auto text-xs text-zinc-500">
            Changes are local to this prototype.
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <Kv
            items={[
              { k: "Status", v: <StatusPill status={order.status} /> },
              { k: "Customer", v: `${order.customerName} <${order.customerEmail}>` },
              { k: "Placed", v: fmtDateTime(order.placedAt) },
              {
                k: "Ship by",
                v: (
                  <span className="flex items-center gap-2">
                    {fmtDateTime(order.shipBy)}
                    {holdsStock && (
                      <Pill tone={deadline.late ? "amber" : "neutral"}>{deadline.text}</Pill>
                    )}
                  </span>
                ),
              },
              {
                k: "Identity key",
                v: <span className="font-mono text-xs text-zinc-600">{order.key}</span>,
              },
            ]}
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Items
          </h3>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Marketplace listing</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-left font-medium">Resolved SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {order.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-zinc-800">{l.listingTitle}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                      {l.quantity}
                    </td>
                    <td className="px-3 py-2">
                      {l.matchStatus === "matched" ? (
                        <span className="font-mono text-xs text-zinc-700">{l.sku}</span>
                      ) : (
                        <Pill tone="amber">
                          {l.matchStatus === "pending_review" ? "match pending" : "unmatched"}
                        </Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.lines.some((l) => l.matchStatus !== "matched") && (
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Unconfirmed lines hold no stock. Confirm the match in Inventory before it
              counts against availability.
            </p>
          )}
        </section>

        {relatedAlerts.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Open alerts involving this order
            </h3>
            <div className="flex flex-col gap-2">
              {relatedAlerts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    selectOrder(null);
                    setView("attention");
                    selectAlert(a.id);
                  }}
                  className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100/60"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="mt-0.5 block text-xs text-amber-800/80">
                    Review and resolve →
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Notification history
          </h3>
          <Callout tone="neutral">
            <p className="text-sm">
              This order has been touched by{" "}
              <strong>
                {order.revisions.length} notification
                {order.revisions.length === 1 ? "" : "s"}
              </strong>
              . Repeat notifications update it in place — identity is channel + order ID,
              so a duplicate can never become a second order.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {order.revisions.map((r, i) => (
                <li key={i} className="font-mono text-xs text-zinc-500">
                  {fmtDateTime(r)}
                  {i === 0 && <span className="ml-2 font-sans">first seen</span>}
                </li>
              ))}
            </ul>
          </Callout>
        </section>
      </div>
    </Drawer>
  );
}
