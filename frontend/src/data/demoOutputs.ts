import { SAMPLE_EMAILS, SEED_ORDERS } from "./seed";
import type { ExtractedOrder } from "../types";

/** Prepared frontend outputs for the two bundled emails, never a live AI result. */
export function sampleExtraction(email: string): ExtractedOrder | null {
  const index = SAMPLE_EMAILS.findIndex(
    (sample) => sample.body.trim() === email.trim(),
  );
  if (index === 0)
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
      demoMode: true,
      notes: "Prepared sample output. No AI service was used.",
    };
  if (index === 1) {
    const order = SEED_ORDERS.find((o) => o.key === "shopify:1042")!;
    return {
      channel: order.channel,
      channelOrderId: order.channelOrderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      placedAt: order.placedAt,
      shipBy: order.shipBy,
      status: order.status,
      lines: order.lines.map(({ listingTitle, quantity }) => ({
        listingTitle,
        quantity,
      })),
      demoMode: true,
      notes: "Prepared duplicate-notification output. No AI service was used.",
    };
  }
  return null;
}
