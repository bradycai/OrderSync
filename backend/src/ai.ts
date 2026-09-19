import {
  CHANNEL_LABELS,
  RESOLUTION_LABELS,
  type Alert,
  type Order,
  type Product,
  type Resolution,
} from "@orderwatch/shared";
import type { z } from "zod";
import {
  DraftSchema,
  ExtractedOrderSchema,
  MatchSuggestionSchema,
  hasCredentials,
  parseWith,
} from "./claude";
import { demoDraft, demoExtract, demoMatch } from "./demoOutputs";

/**
 * The only place the app decides between a real model call and a prepared
 * demo output. Every result carries `demoMode` so the UI can label it.
 *
 * AI is used for judgment only — reading messy email text, guessing a SKU,
 * and writing prose. Stock math, dedupe, and deadlines never come through here.
 */
export type AiResult<T> = T & { demoMode: boolean };

export const isDemoMode = () => !hasCredentials();

/** Confidence at or above this is treated as a match; below it needs a human. */
export const AUTO_ACCEPT_CONFIDENCE = 0.9;

export async function extractOrder(
  email: string,
): Promise<AiResult<z.infer<typeof ExtractedOrderSchema>>> {
  if (isDemoMode()) return { ...demoExtract(email), demoMode: true };

  const out = await parseWith(
    ExtractedOrderSchema,
    "You extract order details from e-commerce notification emails. " +
      "Copy listing titles verbatim — do not normalize, expand, or tidy them; " +
      "downstream SKU matching depends on the exact marketplace wording. " +
      "Return ISO 8601 timestamps in UTC. If the ship-by date is absent, return null. " +
      "If the email describes a cancellation, set status to canceled.",
    email,
  );
  return { ...out, demoMode: false };
}

export async function suggestMatch(
  listingTitle: string,
  catalog: Product[],
): Promise<AiResult<z.infer<typeof MatchSuggestionSchema>>> {
  if (isDemoMode()) return { ...demoMatch(listingTitle), demoMode: true };

  const out = await parseWith(
    MatchSuggestionSchema,
    "You map marketplace listing titles to internal SKUs for a small clothing brand. " +
      "Marketplaces rename the same garment freely, so match on garment type, color, " +
      "and size rather than exact wording. Return null for sku when nothing is a " +
      "plausible match — a wrong match corrupts stock counts. Confidence is your " +
      "honest probability that this is the same physical product.",
    `Listing title: ${listingTitle}\n\nCatalog:\n${JSON.stringify(
      catalog.map((p) => ({ sku: p.sku, title: p.title, color: p.color, size: p.size })),
      null,
      2,
    )}`,
  );
  return { ...out, demoMode: false };
}

export async function draftMessage(
  alert: Alert,
  order: Order,
  resolution: Resolution,
): Promise<AiResult<z.infer<typeof DraftSchema>>> {
  const context = buildDraftContext(alert, order, resolution);
  if (isDemoMode()) return { ...demoDraft(resolution, order), demoMode: true };

  const out = await parseWith(
    DraftSchema,
    "You write short customer-service emails for a small clothing brand — one " +
      "founder, no support team. Be warm, direct, and specific about what went " +
      "wrong and what happens next. No corporate filler, no 'we apologize for any " +
      "inconvenience'. Never invent a ship date, discount, or tracking number that " +
      "is not in the context. Under 120 words. Sign off as 'the team'.",
    context,
  );
  return { ...out, demoMode: false };
}

function buildDraftContext(alert: Alert, order: Order, resolution: Resolution): string {
  const items = order.lines
    .map((l) => `${l.quantity} × ${l.listingTitle}`)
    .join(", ");

  return [
    `Customer: ${order.customerName}`,
    `Channel: ${CHANNEL_LABELS[order.channel]} (order ${order.channelOrderId})`,
    `Items: ${items}`,
    `Promised ship date: ${new Date(order.shipBy).toDateString()}`,
    ``,
    `Problem: ${alert.title}`,
    `Detail: ${alert.explanation}`,
    alert.calculation
      ? `Stock math: ${alert.calculation.startingStock} in stock − ` +
        `${alert.calculation.committed} committed = ${alert.calculation.available} available`
      : ``,
    ``,
    `The founder has chosen this resolution: ${RESOLUTION_LABELS[resolution]}.`,
    `Write the email that puts that resolution into effect.`,
  ]
    .filter(Boolean)
    .join("\n");
}
