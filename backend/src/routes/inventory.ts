import {
  isLow,
  snapshotAll,
  type InventoryRow,
} from "@orderwatch/shared";
import { Router } from "express";
import { db } from "../db";

export const inventoryRouter: Router = Router();

/**
 * GET /api/inventory — recomputed on every request from the current orders.
 *
 * Starting stock is never mutated by an import. Committed units are derived,
 * so importing the same notification twice cannot double-deduct, and a
 * canceled order releases its units the moment its status changes.
 */
inventoryRouter.get("/", (_req, res) => {
  const rows: InventoryRow[] = snapshotAll(db.products, db.orders).map((s) => {
    const product = db.products.find((p) => p.sku === s.sku)!;
    return {
      ...s,
      title: product.title,
      color: product.color,
      size: product.size,
      isShort: s.available < 0,
      isLow: isLow(s),
      mappedChannels: db.listingMaps
        .filter((m) => m.sku === s.sku && m.status === "confirmed")
        .map((m) => m.channel),
    };
  });

  res.json({
    inventory: rows,
    shortages: rows.filter((r) => r.isShort).length,
    lowStock: rows.filter((r) => r.isLow).length,
    /** Matches awaiting confirmation are excluded from `committed` above. */
    pendingMatches: db.listingMaps.filter((m) => m.status === "pending"),
    calculatedAt: new Date().toISOString(),
  });
});
