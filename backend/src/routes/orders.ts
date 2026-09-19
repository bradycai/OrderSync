import {
  CHANNELS,
  defaultShipBy,
  findOrder,
  orderKey,
  resolveLine,
  upsertOrder,
  type Channel,
  type Order,
  type OrderLine,
  type ParsePreview,
  type PreviewLine,
} from "@orderwatch/shared";
import { Router } from "express";
import { z } from "zod";
import { AUTO_ACCEPT_CONFIDENCE, extractOrder, suggestMatch } from "../ai";
import { db } from "../db";
import type { Tables } from "../database";

export const ordersRouter: Router = Router();

const ChannelEnum = z.enum(CHANNELS);
const StatusEnum = z.enum(["awaiting_shipment", "shipped", "delivered", "canceled"]);

/* ------------------------------------------------------------------ *
 * GET /api/orders — list with channel / status / text filters.
 * ------------------------------------------------------------------ */
const FiltersSchema = z.object({
  channel: ChannelEnum.optional(),
  status: StatusEnum.optional(),
  q: z.string().optional(),
});

ordersRouter.get("/", (req, res) => {
  const parsed = FiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid filters", detail: parsed.error.issues });
  }
  const { channel, status, q } = parsed.data;
  const needle = q?.trim().toLowerCase();

  const orders = db.orders.filter((o) => {
    if (channel && o.channel !== channel) return false;
    if (status && o.status !== status) return false;
    if (!needle) return true;
    return (
      o.channelOrderId.toLowerCase().includes(needle) ||
      o.customerName.toLowerCase().includes(needle) ||
      o.lines.some((l) => l.listingTitle.toLowerCase().includes(needle))
    );
  });

  res.json({ orders, total: db.orders.length, filtered: orders.length });
});

/* ------------------------------------------------------------------ *
 * POST /api/orders/parse-email — AI extraction + match resolution.
 * Returns a preview only. Nothing is written.
 * ------------------------------------------------------------------ */
const ParseEmailSchema = z.object({ email: z.string().min(1, "email body is required") });

ordersRouter.post("/parse-email", async (req, res) => {
  const parsed = ParseEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const extracted = await extractOrder(parsed.data.email);
    const warnings: string[] = [];
    if (extracted.notes) warnings.push(extracted.notes);

    const key = orderKey(extracted.channel, extracted.channelOrderId);
    const existing = findOrder(db.orders, key) ?? null;
    if (existing) {
      warnings.push(
        `An order with this channel and ID already exists (seen ${existing.revisions.length}× ` +
          `so far). Importing will update it in place — no duplicate will be created.`,
      );
    }

    const lines: PreviewLine[] = [];
    for (const line of extracted.lines) {
      const resolved = resolveLine(extracted.channel, line.listingTitle, db.listingMaps);
      const base: PreviewLine = {
        listingTitle: line.listingTitle,
        quantity: line.quantity,
        ...resolved,
      };

      // A confirmed mapping already exists — no need to bother the model.
      if (resolved.matchStatus === "matched") {
        lines.push(base);
        continue;
      }

      const s = await suggestMatch(line.listingTitle, db.products);
      const known = s.sku ? db.products.some((p) => p.sku === s.sku) : false;
      const needsConfirmation = !known || s.confidence < AUTO_ACCEPT_CONFIDENCE;

      lines.push({
        ...base,
        // Confident, real SKU → pre-fill it. Otherwise hold it for review.
        sku: needsConfirmation ? null : s.sku,
        matchStatus: needsConfirmation ? "pending_review" : "matched",
        suggestion: {
          sku: known ? s.sku : null,
          confidence: s.confidence,
          reasoning: s.reasoning,
          needsConfirmation,
        },
      });

      if (needsConfirmation) {
        warnings.push(`“${line.listingTitle}” needs a confirmed SKU before it affects stock.`);
      }
    }

    const preview: ParsePreview = {
      extracted,
      key,
      willResult: existing ? "update" : "create",
      existing,
      lines,
      demoMode: extracted.demoMode,
      warnings,
    };
    res.json(preview);
  } catch (err) {
    res.status(502).json({ error: `Extraction failed: ${(err as Error).message}` });
  }
});

/* ------------------------------------------------------------------ *
 * POST /api/orders — save the reviewed order. Deduped on channel + ID.
 * ------------------------------------------------------------------ */
const ConfirmedOrderSchema = z.object({
  channel: ChannelEnum,
  channelOrderId: z.string().min(1),
  customerName: z.string().min(1),
  customerEmail: z.string().min(1),
  placedAt: z.iso.datetime({ offset: true }),
  shipBy: z.iso.datetime({ offset: true }).nullish(),
  status: StatusEnum.default("awaiting_shipment"),
  lines: z
    .array(
      z.object({
        listingTitle: z.string().min(1),
        quantity: z.number().int().positive(),
        sku: z.string().nullish(),
      }),
    )
    .min(1, "an order needs at least one line"),
});

ordersRouter.post("/", (req, res) => {
  const parsed = ConfirmedOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid order", detail: parsed.error.issues });
  }
  const input = parsed.data;

  // Every SKU the founder confirmed must actually exist.
  const unknown = input.lines
    .map((l) => l.sku)
    .filter((sku): sku is string => Boolean(sku))
    .filter((sku) => !db.products.some((p) => p.sku === sku));
  if (unknown.length) {
    return res.status(400).json({ error: `Unknown SKU(s): ${unknown.join(", ")}` });
  }

  const saved = db.write((tables) => {
    const lines: OrderLine[] = input.lines.map((l) => {
      if (l.sku) {
        // Confirming a match teaches the mapping, so the next import resolves itself.
        rememberMapping(tables, input.channel, l.listingTitle, l.sku);
        return {
          listingTitle: l.listingTitle,
          quantity: l.quantity,
          sku: l.sku,
          matchStatus: "matched",
        };
      }
      const resolved = resolveLine(input.channel, l.listingTitle, tables.listingMaps);
      return { listingTitle: l.listingTitle, quantity: l.quantity, ...resolved };
    });

    const incoming: Order = {
      key: orderKey(input.channel, input.channelOrderId),
      channel: input.channel,
      channelOrderId: input.channelOrderId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      placedAt: input.placedAt,
      shipBy: input.shipBy ?? defaultShipBy(input.placedAt),
      status: input.status,
      source: "email_import",
      revisions: [new Date().toISOString()],
      lines,
    };

    const { orders, result } = upsertOrder(tables.orders, incoming);
    tables.orders = orders;

    return {
      order: findOrder(tables.orders, incoming.key),
      result,
      message:
        result === "updated"
          ? "Existing order updated in place — no duplicate created."
          : "Order imported.",
    };
  });
  res.status(saved.result === "created" ? 201 : 200).json(saved);
});

/** Record a founder-confirmed listing → SKU mapping if we don't have it. */
function rememberMapping(tables: Tables, channel: Channel, listingTitle: string, sku: string): void {
  const norm = listingTitle.trim().toLowerCase();
  const existing = tables.listingMaps.find(
    (m) => m.channel === channel && m.listingTitle.trim().toLowerCase() === norm,
  );
  if (existing) {
    existing.sku = sku;
    existing.status = "confirmed";
    existing.confidence = 1;
    existing.source = "manual";
    return;
  }
  tables.listingMaps.push({
    id: `lm-${tables.listingMaps.length + 1}-${Date.now().toString(36)}`,
    channel,
    listingTitle,
    sku,
    confidence: 1,
    status: "confirmed",
    source: "manual",
  });
}
