import type { Alert, InventorySnapshot, Order, Product, SuggestedAction } from "../types";
import { CHANNEL_LABELS } from "../types";
import { holdsStock, snapshotAll } from "./inventory";

/**
 * Alert detection is fully deterministic — no model involvement. The AI only
 * drafts the message copy once an alert already exists.
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
      const units = (n: number) => `${n} unit${n === 1 ? "" : "s"}`;
      const channels = s.contributingOrderKeys
        .map((k) => orders.find((o) => o.key === k)!)
        .map((o) => CHANNEL_LABELS[o.channel]);
      const bumped = lastPlaced(orders, s.contributingOrderKeys);
      const bumpedOrder = orders.find((o) => o.key === bumped)!;

      const actions: SuggestedAction[] = [
        {
          type: "message_customer",
          orderKey: bumped,
          label: "Draft a delay message",
          description:
            `Write to ${bumpedOrder.customerName} — the most recently placed of the ` +
            `${s.contributingOrderKeys.length} orders, and so the fairest one to hold.`,
        },
        {
          type: "adjust_inventory",
          sku: s.sku,
          delta: short,
          label: `Record a restock of ${units(short)}`,
          description:
            `Use this if you have found ${units(short)} ` +
            `${short === 1 ? "that was" : "that were"} not counted. ` +
            `It raises starting stock and clears the shortage outright.`,
        },
      ];

      return {
        id: `shortage:${s.sku}`,
        // Re-opens the alert if stock or commitments move after it was handled.
        signature: `shortage:${s.sku}:${s.startingStock}:${s.committed}`,
        kind: "insufficient_inventory",
        severity: "critical",
        title: `${units(short)} short — ${product.title}, ${product.color} / ${product.size}`,
        explanation:
          `${channels.join(", ")} sold ${s.committed} units of ${s.sku} but only ` +
          `${s.startingStock} are in stock. ${units(short)} cannot be fulfilled.`,
        calculation: s,
        relatedOrderKeys: s.contributingOrderKeys,
        suggestedActions: actions,
      } satisfies Alert;
    });
}

function overdueAlerts(orders: Order[], now: Date): Alert[] {
  return orders
    .filter((o) => holdsStock(o) && new Date(o.shipBy) < now)
    .map((o) => {
      const hoursLate = Math.round(
        (now.getTime() - new Date(o.shipBy).getTime()) / 3_600_000,
      );
      return {
        id: `overdue:${o.key}`,
        signature: `overdue:${o.key}:${o.shipBy}`,
        kind: "overdue_shipment",
        severity: hoursLate > 48 ? "critical" : "warning",
        title: `Overdue by ${hoursLate}h — ${CHANNEL_LABELS[o.channel]} ${o.channelOrderId}`,
        explanation:
          `The shipping deadline passed ${hoursLate} hours ago and this order is ` +
          `still awaiting shipment.`,
        relatedOrderKeys: [o.key],
        suggestedActions: [
          {
            type: "message_customer",
            orderKey: o.key,
            label: "Draft an apology and a new ship date",
            description: `Write to ${o.customerName} with a realistic updated date.`,
          },
        ],
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
