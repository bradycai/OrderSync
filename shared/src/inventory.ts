import type { InventorySnapshot, Order, Product } from "./types";

/**
 * Deterministic stock math. Starting stock is never mutated by imports —
 * commitments are always recomputed from the current order list, so importing
 * the same order twice can never double-count a deduction.
 */

/** Orders that hold stock: not canceled, not yet out the door. */
export const holdsStock = (o: Order) =>
  o.status === "awaiting_shipment";

export function snapshotFor(product: Product, orders: Order[]): InventorySnapshot {
  let committed = 0;
  const contributingOrderKeys: string[] = [];

  for (const order of orders) {
    if (!holdsStock(order)) continue;
    let qty = 0;
    for (const line of order.lines) {
      // Pending / unmatched lines are deliberately excluded until confirmed.
      if (line.matchStatus !== "matched") continue;
      if (line.sku !== product.sku) continue;
      qty += line.quantity;
    }
    if (qty > 0) {
      committed += qty;
      contributingOrderKeys.push(order.key);
    }
  }

  return {
    sku: product.sku,
    startingStock: product.startingStock,
    committed,
    available: product.startingStock - committed,
    contributingOrderKeys,
  };
}

export function snapshotAll(products: Product[], orders: Order[]): InventorySnapshot[] {
  return products.map((p) => snapshotFor(p, orders));
}

export const LOW_STOCK_THRESHOLD = 2;

export const isLow = (s: InventorySnapshot) =>
  s.available >= 0 && s.available <= LOW_STOCK_THRESHOLD;
