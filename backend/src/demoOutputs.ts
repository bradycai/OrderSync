/**
 * Prepared outputs used when ANTHROPIC_API_KEY is absent. Everything returned
 * from here is flagged `demoMode: true` upstream so the UI can label it.
 * These are written by hand — they are not model output and are not claimed to be.
 */
import { CHANNEL_LABELS, type Order, type Resolution } from "@orderwatch/shared";
import type { z } from "zod";
import type { DraftSchema, ExtractedOrderSchema, MatchSuggestionSchema } from "./claude";

type Extracted = z.infer<typeof ExtractedOrderSchema>;
type Match = z.infer<typeof MatchSuggestionSchema>;
type Draft = z.infer<typeof DraftSchema>;

export function demoExtract(email: string): Extracted {
  // Recognize the two bundled samples so the scripted demo is reproducible.
  if (/#?\b1042\b/.test(email)) {
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
  if (/fleece hoodie/i.test(email)) {
    return {
      channel: "amazon",
      channelOrderId: "114-5567012-3344100",
      customerName: "Dev Chaudhry",
      customerEmail: "dev.c@example.com",
      placedAt: "2026-09-19T11:30:00Z",
      shipBy: null,
      status: "awaiting_shipment",
      lines: [{ listingTitle: "Premium Fleece Hoodie, Black, Medium", quantity: 1 }],
      notes: "Listing name does not match the catalog exactly — confirm the SKU.",
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
    notes: "Demo-mode extraction — no model was called.",
  };
}

export function demoMatch(listingTitle: string): Match {
  if (/fleece hoodie/i.test(listingTitle)) {
    return {
      sku: "HOODIE-BLK-M",
      confidence: 0.72,
      reasoning:
        "‘Premium Fleece Hoodie, Black, Medium’ is probably HOODIE-BLK-M, but the " +
        "catalog says heavyweight cotton, not fleece. Confirm before it counts against stock.",
    };
  }
  if (/hoodie/i.test(listingTitle) && /\b(l|large)\b/i.test(listingTitle)) {
    return { sku: "HOODIE-BLK-L", confidence: 0.94, reasoning: "Black hoodie, size L." };
  }
  return {
    sku: null,
    confidence: 0.2,
    reasoning: "Demo-mode output — nothing in the catalog is a confident match.",
  };
}

export function demoDraft(resolution: Resolution, order: Order): Draft {
  const who = order.customerName.split(" ")[0];
  const where = CHANNEL_LABELS[order.channel];
  const tail = `\n\n— The team\n\n[Demo-mode draft, written by hand. No model was called.]`;

  const bodies: Record<Resolution, { subject: string; body: string }> = {
    delay_and_apologize: {
      subject: "A short delay on your order",
      body:
        `Hi ${who},\n\nThanks for your ${where} order. We sold through our black medium ` +
        `hoodies across a few storefronts at the same time, and yours is one unit short ` +
        `right now. The next batch lands this week and I'll ship yours the day it arrives.\n\n` +
        `If you'd rather not wait, reply and I'll refund you in full today.`,
    },
    offer_refund: {
      subject: "Refunding your order",
      body:
        `Hi ${who},\n\nYour ${where} order sold out from under us — three storefronts took ` +
        `the last of our black medium hoodies within a day of each other, and I can't fill ` +
        `yours. I've refunded you in full; it should land back on your card in a few days.\n\n` +
        `Sorry for the letdown. Reply here if you'd like me to set one aside from the next batch.`,
    },
    partial_shipment: {
      subject: "Shipping part of your order now",
      body:
        `Hi ${who},\n\nOne item from your ${where} order is ready to go, and one is briefly ` +
        `out of stock. I'm shipping what's ready today so you're not waiting on the whole ` +
        `order, and the rest follows as soon as the next batch arrives this week.\n\n` +
        `No extra shipping charge, and I'll send tracking for both.`,
    },
    cancel_and_refund: {
      subject: "Cancelling your order",
      body:
        `Hi ${who},\n\nAs requested, I've cancelled your ${where} order and refunded it in ` +
        `full. The money should be back on your card within a few business days.\n\n` +
        `Thanks for bearing with us — if you want back in when we restock, just reply.`,
    },
    inventory_correction: {
      subject: "Your order is on track",
      body:
        `Hi ${who},\n\nQuick update: a stock-count error on our side briefly flagged your ` +
        `${where} order as unfulfillable. It isn't — the item is in the warehouse and your ` +
        `order ships on schedule.\n\nNo action needed. Sorry for any confusion.`,
    },
  };

  const picked = bodies[resolution];
  return { subject: picked.subject, body: picked.body + tail };
}
