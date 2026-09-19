import type { ExtractedOrder, ListingMap, Order, OrderLine } from "../types";

/** Identity is channel + marketplace order id. Nothing else. */
export const orderKey = (channel: string, channelOrderId: string) =>
  `${channel}:${channelOrderId.trim().toUpperCase()}`;

export const findOrder = (orders: Order[], key: string) =>
  orders.find((o) => o.key === key);

/** Deterministic deadline when the notification does not state one. */
export function defaultShipBy(placedAt: string, businessDays = 2): string {
  const d = new Date(placedAt);
  let added = 0;
  while (added < businessDays) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  d.setUTCHours(17, 0, 0, 0);
  return d.toISOString();
}

/** Resolve a marketplace listing title to a SKU using confirmed maps only. */
export function resolveLine(
  channel: string,
  listingTitle: string,
  maps: ListingMap[],
): Pick<OrderLine, "sku" | "matchStatus"> {
  const norm = listingTitle.trim().toLowerCase();
  const hit = maps.find(
    (m) => m.channel === channel && m.listingTitle.trim().toLowerCase() === norm,
  );
  if (!hit) return { sku: null, matchStatus: "unmatched" };
  if (hit.status === "confirmed") return { sku: hit.sku, matchStatus: "matched" };
  if (hit.status === "pending") return { sku: null, matchStatus: "pending_review" };
  // Rejected: the founder said this is not our product, so it goes back to
  // being unmatched rather than lingering in the review queue.
  return { sku: null, matchStatus: "unmatched" };
}

export function toOrder(extracted: ExtractedOrder, maps: ListingMap[]): Order {
  const placedAt = extracted.placedAt;
  return {
    key: orderKey(extracted.channel, extracted.channelOrderId),
    channel: extracted.channel,
    channelOrderId: extracted.channelOrderId,
    customerName: extracted.customerName,
    customerEmail: extracted.customerEmail,
    placedAt,
    shipBy: extracted.shipBy ?? defaultShipBy(placedAt),
    status: extracted.status,
    source: "email_import",
    revisions: [new Date().toISOString()],
    lines: extracted.lines.map((l) => ({
      listingTitle: l.listingTitle,
      quantity: l.quantity,
      ...resolveLine(extracted.channel, l.listingTitle, maps),
    })),
  };
}

/**
 * Recompute every line's SKU resolution against the current mapping table.
 * Deterministic and idempotent — running it twice changes nothing. Called
 * whenever a listing map is confirmed or rejected, so a newly-confirmed match
 * immediately starts counting toward committed stock.
 */
export function reresolveOrders(orders: Order[], maps: ListingMap[]): Order[] {
  return orders.map((o) => ({
    ...o,
    lines: o.lines.map((l) => ({
      ...l,
      ...resolveLine(o.channel, l.listingTitle, maps),
    })),
  }));
}

export type ImportOutcome = { orders: Order[]; result: "created" | "updated" };

/**
 * Upsert by key: a repeated notification revises the existing order in place
 * rather than creating a second one.
 */
export function upsertOrder(orders: Order[], incoming: Order): ImportOutcome {
  const idx = orders.findIndex((o) => o.key === incoming.key);
  if (idx === -1) return { orders: [incoming, ...orders], result: "created" };

  const existing = orders[idx];
  const merged: Order = {
    ...existing,
    ...incoming,
    source: existing.source,
    revisions: [...existing.revisions, ...incoming.revisions],
  };
  const next = orders.slice();
  next[idx] = merged;
  return { orders: next, result: "updated" };
}
