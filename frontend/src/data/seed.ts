import type { ListingMap, Order, Product } from "../types";

/**
 * Fixed "now" so the demo is reproducible: overdue orders stay overdue,
 * deadlines never drift between runs.
 */
export const DEMO_NOW = new Date("2026-09-19T14:00:00Z");

const day = (offset: number, hour = 17) => {
  const d = new Date(DEMO_NOW);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Small clothing catalog. SAMPLE DATA. */
export const SEED_PRODUCTS: Product[] = [
  { sku: "HOODIE-BLK-M", title: "Heavyweight Hoodie", color: "Black", size: "M", startingStock: 5 },
  { sku: "HOODIE-BLK-L", title: "Heavyweight Hoodie", color: "Black", size: "L", startingStock: 12 },
  { sku: "HOODIE-OAT-M", title: "Heavyweight Hoodie", color: "Oatmeal", size: "M", startingStock: 8 },
  { sku: "TEE-WHT-S", title: "Boxy Tee", color: "White", size: "S", startingStock: 24 },
  { sku: "TEE-WHT-M", title: "Boxy Tee", color: "White", size: "M", startingStock: 3 },
  { sku: "CAP-NVY-OS", title: "Corduroy Cap", color: "Navy", size: "OS", startingStock: 16 },
];

/**
 * The same garment is listed under a different name on every marketplace.
 * `confirmed` mappings count toward committed stock; `pending` ones do not.
 */
export const SEED_LISTING_MAPS: ListingMap[] = [
  { id: "lm-1", channel: "shopify", listingTitle: "Heavyweight Hoodie — Black / M", sku: "HOODIE-BLK-M", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-2", channel: "tiktok", listingTitle: "Oversized Black Hoodie (Medium)", sku: "HOODIE-BLK-M", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-3", channel: "ebay", listingTitle: "BLACK HOODIE HEAVY 400GSM SZ M", sku: "HOODIE-BLK-M", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-4", channel: "amazon", listingTitle: "Premium Fleece Hoodie, Black, Medium", sku: "HOODIE-BLK-M", confidence: 0.72, status: "pending", source: "seed" },
  { id: "lm-5", channel: "shopify", listingTitle: "Boxy Tee — White / M", sku: "TEE-WHT-M", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-6", channel: "amazon", listingTitle: "Relaxed Cotton T-Shirt White M", sku: "TEE-WHT-M", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-7", channel: "tiktok", listingTitle: "Cord Cap Navy", sku: "CAP-NVY-OS", confidence: 1, status: "confirmed", source: "seed" },
  { id: "lm-8", channel: "ebay", listingTitle: "Heavy Hoodie Black Large", sku: "HOODIE-BLK-L", confidence: 1, status: "confirmed", source: "seed" },
];

const order = (o: Omit<Order, "key" | "revisions"> & { revisions?: string[] }): Order => ({
  ...o,
  key: `${o.channel}:${o.channelOrderId}`,
  revisions: o.revisions ?? [o.placedAt],
});

/**
 * SAMPLE DATA. Core demo: 5 units of HOODIE-BLK-M on hand, but Shopify,
 * TikTok Shop, and eBay each sold 2 → 6 committed, 1 short.
 */
export const SEED_ORDERS: Order[] = [
  order({
    channel: "shopify", channelOrderId: "1042", customerName: "Priya Raman",
    customerEmail: "priya@example.com", placedAt: day(-2, 9), shipBy: day(1),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "Heavyweight Hoodie — Black / M", quantity: 2, sku: "HOODIE-BLK-M", matchStatus: "matched" }],
  }),
  order({
    channel: "tiktok", channelOrderId: "TT-88231", customerName: "Marcus Webb",
    customerEmail: "mwebb@example.com", placedAt: day(-1, 20), shipBy: day(2),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "Oversized Black Hoodie (Medium)", quantity: 2, sku: "HOODIE-BLK-M", matchStatus: "matched" }],
  }),
  order({
    channel: "ebay", channelOrderId: "07-13345-99210", customerName: "Dana Kowalski",
    customerEmail: "dkowalski@example.com", placedAt: day(-1, 11), shipBy: day(0, 12),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "BLACK HOODIE HEAVY 400GSM SZ M", quantity: 2, sku: "HOODIE-BLK-M", matchStatus: "matched" }],
  }),
  // Overdue: deadline was yesterday and it still has not shipped.
  order({
    channel: "amazon", channelOrderId: "114-2288371-5540122", customerName: "Ellis Trent",
    customerEmail: "etrent@example.com", placedAt: day(-5, 8), shipBy: day(-1, 17),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "Relaxed Cotton T-Shirt White M", quantity: 2, sku: "TEE-WHT-M", matchStatus: "matched" }],
  }),
  // Uncertain match: Amazon listing is only a probable hoodie match, held for review.
  order({
    channel: "amazon", channelOrderId: "114-9910233-7781004", customerName: "Sofia Alvarez",
    customerEmail: "salvarez@example.com", placedAt: day(-1, 15), shipBy: day(3),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "Premium Fleece Hoodie, Black, Medium", quantity: 1, sku: null, matchStatus: "pending_review" }],
  }),
  order({
    channel: "shopify", channelOrderId: "1039", customerName: "Jon Baptiste",
    customerEmail: "jbaptiste@example.com", placedAt: day(-4, 10), shipBy: day(-2, 17),
    status: "shipped", source: "seed",
    lines: [{ listingTitle: "Boxy Tee — White / M", quantity: 1, sku: "TEE-WHT-M", matchStatus: "matched" }],
  }),
  // Canceled orders must never hold stock.
  order({
    channel: "tiktok", channelOrderId: "TT-88104", customerName: "Rae Lindqvist",
    customerEmail: "rae@example.com", placedAt: day(-3, 19), shipBy: day(-1, 17),
    status: "canceled", source: "seed",
    lines: [{ listingTitle: "Oversized Black Hoodie (Medium)", quantity: 1, sku: "HOODIE-BLK-M", matchStatus: "matched" }],
  }),
  order({
    channel: "ebay", channelOrderId: "07-13345-99377", customerName: "Tomas Oyelaran",
    customerEmail: "tomas@example.com", placedAt: day(0, 8), shipBy: day(2),
    status: "awaiting_shipment", source: "seed",
    lines: [{ listingTitle: "Heavy Hoodie Black Large", quantity: 1, sku: "HOODIE-BLK-L", matchStatus: "matched" }],
  }),
];

/** Pasteable in the email intake screen. */
export const SAMPLE_EMAILS: { label: string; body: string }[] = [
  {
    label: "TikTok Shop — new order",
    body: `From: orders@tiktokshop.com
Subject: New order TT-88402 is ready to fulfill

Hi! You have a new order.

Order number: TT-88402
Placed: 19 Sep 2026, 08:14 UTC
Buyer: Nina Osei (nina.osei@example.com)
Ship by: 22 Sep 2026

1 x Oversized Black Hoodie (Medium)
1 x Cord Cap Navy

Total: $94.00`,
  },
  {
    label: "Shopify — duplicate notification for order 1042",
    body: `From: mailer@shopify.com
Subject: Order #1042 updated

Order #1042 has been updated.

Customer: Priya Raman <priya@example.com>
Placed: 17 Sep 2026 09:00 UTC
Ship by: 20 Sep 2026
Items: 2 x Heavyweight Hoodie — Black / M
Status: unfulfilled`,
  },
];
