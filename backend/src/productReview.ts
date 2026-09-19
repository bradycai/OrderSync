import { randomUUID } from "node:crypto";
import type { Channel } from "@orderwatch/shared";
import type { Tables } from "./database";

const normalize = (title: string) => title.trim().toLowerCase();

export function pendingReviews(tables: Pick<Tables, "orders" | "listingMaps">) {
  const groups = new Map<string, { channel: Channel; listingTitle: string; suggestedSku: string | null; orderKeys: string[] }>();
  for (const order of tables.orders) for (const line of order.lines) {
    if (line.matchStatus === "matched") continue;
    const key = JSON.stringify([order.channel, normalize(line.listingTitle)]);
    const mapping = tables.listingMaps.find(m => m.channel === order.channel && normalize(m.listingTitle) === normalize(line.listingTitle));
    const group = groups.get(key) ?? { channel: order.channel, listingTitle: line.listingTitle, suggestedSku: mapping?.sku ?? null, orderKeys: [] };
    if (!group.orderKeys.includes(order.key)) group.orderKeys.push(order.key);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Caller runs this in a transaction so mappings and affected order lines agree. */
export function confirmProductMatch(tables: Tables, channel: Channel, listingTitle: string, sku: string) {
  if (!tables.products.some(p => p.sku === sku)) throw new Error("Unknown SKU");
  const title = normalize(listingTitle);
  let updatedLines = 0;
  for (const order of tables.orders) {
    if (order.channel !== channel) continue;
    for (const line of order.lines) {
      if (normalize(line.listingTitle) !== title || line.matchStatus === "matched") continue;
      line.sku = sku;
      line.matchStatus = "matched";
      updatedLines++;
    }
  }
  if (!updatedLines) throw new Error("This listing has no pending order lines. Refresh and try again.");
  const mapping = tables.listingMaps.find(m => m.channel === channel && normalize(m.listingTitle) === title);
  const fields = { sku, status: "confirmed" as const, confidence: 1, source: "manual" as const };
  if (mapping) Object.assign(mapping, fields);
  else tables.listingMaps.push({ id: `lm-${randomUUID()}`, channel, listingTitle, ...fields });
  return { updatedLines };
}
