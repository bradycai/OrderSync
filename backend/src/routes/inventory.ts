import {
  CHANNELS,
  isLow,
  snapshotAll,
  type InventoryRow,
} from "@orderwatch/shared";
import { Router } from "express";
import { db } from "../db";
import { z } from "zod";
import { confirmProductMatch, pendingReviews } from "../productReview";

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

/** Include unresolved lines even when there is no suggested SKU. */
inventoryRouter.get("/matches", (_req, res) => {
  res.json({ matches: pendingReviews(db) });
});
const MatchSchema = z.object({
  channel: z.enum(CHANNELS), listingTitle: z.string().trim().min(1), sku: z.string().min(1),
});
inventoryRouter.post("/matches/confirm", (req, res) => {
  const parsed = MatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a listing and valid SKU." });
  const { channel, listingTitle, sku } = parsed.data;
  if (!db.products.some(p => p.sku === sku)) return res.status(400).json({ error: "Unknown SKU" });
  const result = db.write(tables => {
    if (!pendingReviews(tables).some(m => m.channel === channel && m.listingTitle.trim().toLowerCase() === listingTitle.toLowerCase())) return null;
    return confirmProductMatch(tables, channel, listingTitle, sku);
  });
  if (!result) return res.status(409).json({ error: "This match has already been reviewed. Refresh and try again." });
  res.json(result);
});
