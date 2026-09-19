import type { Alert, InventorySnapshot, Order, Product } from "../types";
import { CHANNEL_LABELS } from "../types";
import { snapshotAll } from "./inventory";
import { holdsStock } from "./inventory";

/**
 * Alert detection is fully deterministic — no model involvement. The AI only
 * drafts the message copy once an alert exists.
 */
export function detectAlerts(
  products: Product[],
  orders: Order[],
  now: Date,
): Alert[] {
  return [...shortageAlerts(products, orders), ...overdueAlerts(orders, now)];
}

function shortageAlerts(products: Product[], orders: Order[]): Alert[] {
  return snapshotAll(products, orders)
    .filter((s) => s.available < 0)
    .map((s) => {
      const product = products.find((p) => p.sku === s.sku)!;
      const short = Math.abs(s.available);
      const channels = s.contributingOrderKeys
        .map((k) => orders.find((o) => o.key === k)!)
        .map((o) => CHANNEL_LABELS[o.channel]);
      return {
        id: `shortage:${s.sku}`,
        kind: "insufficient_inventory",
        severity: "critical",
        title: `${short} unit${short === 1 ? "" : "s"} short — ${product.title} ${product.color} / ${product.size}`,
        explanation:
          `${channels.join(", ")} sold ${s.committed} units of ${s.sku} but only ` +
          `${s.startingStock} are in stock. ${short} unit${short === 1 ? "" : "s"} cannot be fulfilled.`,
        calculation: s,
        relatedOrderKeys: s.contributingOrderKeys,
        suggestedAction: {
          type: "message_customer",
          orderKey: lastPlaced(orders, s.contributingOrderKeys),
          label: "Draft a delay message for the most recent order",
        },
      } satisfies Alert;
    });
}

function overdueAlerts(orders: Order[], now: Date): Alert[] {
  return orders
    .filter((o) => holdsStock(o) && new Date(o.shipBy) < now)
    .map((o) => {
      const hoursLate = Math.round((now.getTime() - new Date(o.shipBy).getTime()) / 3_600_000);
      return {
        id: `overdue:${o.key}`,
        kind: "overdue_shipment",
        severity: hoursLate > 48 ? "critical" : "warning",
        title: `Overdue — ${CHANNEL_LABELS[o.channel]} ${o.channelOrderId}`,
        explanation:
          `Shipping deadline passed ${hoursLate}h ago and the order is still awaiting shipment.`,
        relatedOrderKeys: [o.key],
        suggestedAction: {
          type: "message_customer",
          orderKey: o.key,
          label: "Draft an apology + updated ship date",
        },
      } satisfies Alert;
    });
}

/** Most recently placed order is the fairest one to bump. */
function lastPlaced(orders: Order[], keys: string[]): string {
  return keys
    .map((k) => orders.find((o) => o.key === k)!)
    .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt))[0].key;
}

export const evidenceLine = (s: InventorySnapshot) =>
  `${s.startingStock} in stock − ${s.committed} committed = ${s.available} available`;
