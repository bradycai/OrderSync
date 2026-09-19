import type { Channel, ListingMap, Order, OrderStatus } from "./types";

/** Additional synthetic orders. Stable identities make loading them repeatable. */
const customers = [
  "Avery Chen", "Jordan Ellis", "Maya Patel", "Noah Brooks", "Lena Ortiz",
  "Theo Nguyen", "Amara Cole", "Ethan Park", "Isla Morgan", "Leo Bennett",
  "Nora Ahmed", "Caleb Ross", "Zoe Kim", "Owen Rivera", "Mila Foster",
  "Felix Reed", "Aria Shah", "Jasper Bell", "Elena Cruz", "Miles Turner",
  "Ruby Evans", "Silas Gray", "Chloe Lin", "Adrian Woods", "Ivy Carter",
  "Oscar Diaz", "Layla James", "Finn Hughes", "Stella Price", "Nico Walsh",
];
const channels: Channel[] = ["shopify", "tiktok", "amazon", "ebay"];
const titles: Record<string, string[]> = {
  "CAP-NVY-OS": ["Corduroy Cap — Navy", "Navy Cord Dad Cap", "Navy Corduroy Baseball Cap Adjustable", "CORD CAP NAVY ONE SIZE"],
  "TEE-WHT-S": ["Boxy Tee — White / S", "White Boxy Tee Small", "Relaxed Cotton T-Shirt White Small", "WHITE BOXY TEE SIZE S"],
  "HOODIE-OAT-M": ["Heavyweight Hoodie — Oatmeal / M", "Oatmeal Oversized Hoodie Medium", "Premium Fleece Hoodie Oatmeal Medium", "OATMEAL HEAVY HOODIE SZ M"],
  "HOODIE-BLK-L": ["Heavyweight Hoodie — Black / L", "Oversized Black Hoodie Large", "Premium Fleece Hoodie Black Large", "Heavy Hoodie Black Large"],
};
// SKU, quantity, shipping deadline offset (hours from the fixed demo clock).
const scenarios: [string, number, number][] = [
  ["CAP-NVY-OS", 1, -6], ["TEE-WHT-S", 2, -12], ["CAP-NVY-OS", 1, -21], ["TEE-WHT-S", 1, -30],
  ["CAP-NVY-OS", 2, -40], ["TEE-WHT-S", 2, -45], ["CAP-NVY-OS", 1, -72], ["TEE-WHT-S", 1, -96],
  ["HOODIE-OAT-M", 3, -18], ["HOODIE-OAT-M", 3, 24], ["HOODIE-OAT-M", 4, 48],
  ["HOODIE-BLK-L", 3, 24], ["HOODIE-BLK-L", 3, 48], ["HOODIE-BLK-L", 3, 72],
  ["CAP-NVY-OS", 2, 24], ["TEE-WHT-S", 2, 36], ["CAP-NVY-OS", 1, 48], ["TEE-WHT-S", 3, 60],
  ["CAP-NVY-OS", 1, 72], ["TEE-WHT-S", 2, 96],
  ["HOODIE-OAT-M", 1, -24], ["HOODIE-BLK-L", 2, -48], ["CAP-NVY-OS", 1, -24], ["TEE-WHT-S", 2, -48],
  ["HOODIE-OAT-M", 2, -120], ["HOODIE-BLK-L", 1, -144], ["CAP-NVY-OS", 2, -120], ["TEE-WHT-S", 1, -168],
  ["HOODIE-OAT-M", 4, -12], ["CAP-NVY-OS", 3, 24],
];
const date = (hours: number) => new Date(Date.UTC(2026, 8, 19, 14) + hours * 3600000).toISOString();
export const EXTRA_ORDERS: Order[] = scenarios.map(([sku, quantity, deadline], i) => {
  const channel = channels[i % 4];
  const channelOrderId = [String(1100 + i), `TT-${89000 + i}`, `114-3300000-${6600000 + i}`, `07-14400-${99500 + i}`][i % 4];
  const status: OrderStatus = i < 20 ? "awaiting_shipment" : i < 24 ? "shipped" : i < 28 ? "delivered" : "canceled";
  const placedAt = date(Math.min(deadline - 72, -4 - i));
  return {
    key: `${channel}:${channelOrderId}`, channel, channelOrderId,
    customerName: customers[i], customerEmail: `${customers[i].toLowerCase().replaceAll(" ", ".")}@example.com`,
    placedAt, shipBy: date(deadline), status, source: "seed", revisions: [placedAt],
    lines: [{ listingTitle: titles[sku][i % 4], sku, quantity, matchStatus: "matched" }],
  };
});
export const EXTRA_LISTING_MAPS: ListingMap[] = [...new Map(EXTRA_ORDERS.map(o => [
  `${o.channel}:${o.lines[0].listingTitle}`, {
    id: `extra-map-${o.key}`, channel: o.channel, listingTitle: o.lines[0].listingTitle,
    sku: o.lines[0].sku!, confidence: 1, status: "confirmed" as const, source: "seed" as const,
  },
])).values()];
