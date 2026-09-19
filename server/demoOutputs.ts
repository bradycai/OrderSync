/**
 * Prepared outputs used when ANTHROPIC_API_KEY is absent. Everything returned
 * from here is flagged `demoMode: true` so the UI can label it.
 */
import type { z } from "zod";
import type { ExtractedOrderSchema, MatchSuggestionSchema, DraftSchema } from "./claude";

type Extracted = z.infer<typeof ExtractedOrderSchema>;
type Match = z.infer<typeof MatchSuggestionSchema>;
type Draft = z.infer<typeof DraftSchema>;

export function demoExtract(email: string): Extracted {
  // TODO: replace with real AI call — set ANTHROPIC_API_KEY and this whole
  // branch is skipped in favour of the live extraction in server/index.ts.
  const isShopifyDupe = /#?1042/.test(email);
  if (isShopifyDupe) {
    return {
      channel: "shopify",
      channelOrderId: "1042",
      customerName: "Priya Raman",
      customerEmail: "priya@example.com",
      placedAt: "2026-09-17T09:00:00Z",
      shipBy: "2026-09-20T17:00:00Z",
      status: "awaiting_shipment",
      lines: [{ listingTitle: "Heavyweight Hoodie — Black / M", quantity: 2 }],
      notes: "Repeat notification for an order already in OrderWatch.",
    };
  }
  if (/114-7781220/.test(email)) {
    return {
      channel: "amazon",
      channelOrderId: "114-7781220-3390115",
      customerName: "Harun Cetin",
      customerEmail: "hcetin@example.com",
      placedAt: "2026-09-19T10:22:00Z",
      shipBy: "2026-09-23T17:00:00Z",
      status: "awaiting_shipment",
      lines: [{ listingTitle: "Corduroy 6-Panel Hat — Navy Blue, One Size", quantity: 1 }],
      notes: "This listing name is not in the mapping table — it will need a SKU match.",
    };
  }
  return {
    channel: "tiktok",
    channelOrderId: "TT-88402",
    customerName: "Nina Osei",
    customerEmail: "nina.osei@example.com",
    placedAt: "2026-09-19T08:14:00Z",
    shipBy: "2026-09-22T17:00:00Z",
    status: "awaiting_shipment",
    lines: [
      { listingTitle: "Oversized Black Hoodie (Medium)", quantity: 1 },
      { listingTitle: "Cord Cap Navy", quantity: 1 },
    ],
    notes: "Demo-mode output — no model was called.",
  };
}

export function demoMatch(listingTitle: string): Match {
  // TODO: replace with real AI call.
  if (/fleece hoodie/i.test(listingTitle)) {
    return {
      sku: "HOODIE-BLK-M",
      confidence: 0.72,
      reasoning: "‘Premium Fleece Hoodie, Black, Medium’ is probably the same garment as HOODIE-BLK-M, but the fabric wording differs — confirm before it counts against stock.",
    };
  }
  if (/corduroy|6-panel|hat|cap/i.test(listingTitle)) {
    return {
      sku: "CAP-NVY-OS",
      confidence: 0.68,
      reasoning:
        "‘Corduroy 6-Panel Hat — Navy Blue, One Size’ lines up with CAP-NVY-OS on fabric, " +
        "colour and sizing, but the catalog calls it a cap rather than a 6-panel hat. " +
        "Below the auto-confirm bar — a human should confirm it.",
    };
  }
  return { sku: null, confidence: 0.3, reasoning: "Demo-mode output — no confident match." };
}

export function demoDraft(context: string): Draft {
  // TODO: replace with real AI call.
  return {
    subject: "A short delay on your hoodie order",
    body:
      `Hi there,\n\nThanks for your order. We sold through our black medium hoodies across ` +
      `a few storefronts at once, and yours is one unit short right now. Our next batch ` +
      `lands within the week, and I'll ship yours the day it arrives.\n\n` +
      `If you'd rather not wait, reply and I'll refund you in full today.\n\n` +
      `— The team\n\n[Demo-mode draft. Context: ${context.slice(0, 80)}…]`,
  };
}
