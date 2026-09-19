/**
 * Temporary verification harness for the deterministic layer.
 * Asserts the invariants the demo's credibility rests on.
 */
import { SEED_LISTING_MAPS, SEED_ORDERS, SEED_PRODUCTS, DEMO_NOW } from "../src/data/seed";
import { snapshotAll, snapshotFor, isLow } from "../src/lib/inventory";
import { detectAlerts } from "../src/lib/alerts";
import {
  orderKey,
  defaultShipBy,
  upsertOrder,
  reresolveOrders,
  resolveLine,
  toOrder,
} from "../src/lib/orders";
import type { ExtractedOrder, ListingMap, Order, Product } from "../src/types";

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  }
}

const products: Product[] = structuredClone(SEED_PRODUCTS);
const orders: Order[] = structuredClone(SEED_ORDERS);
const maps: ListingMap[] = structuredClone(SEED_LISTING_MAPS);

console.log("\n== 1. Core demo scenario: black medium hoodie ==");
const hoodie = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, orders);
check("starting stock is 5", hoodie.startingStock === 5, hoodie.startingStock);
check("committed is 6 (3 channels x 2)", hoodie.committed === 6, hoodie.committed);
check("available is -1", hoodie.available === -1, hoodie.available);
check("exactly 3 contributing orders", hoodie.contributingOrderKeys.length === 3, hoodie.contributingOrderKeys);
const contribChannels = hoodie.contributingOrderKeys.map((k) => k.split(":")[0]).sort();
check(
  "contributors are shopify + tiktok + ebay",
  JSON.stringify(contribChannels) === JSON.stringify(["ebay", "shopify", "tiktok"]),
  contribChannels,
);
check(
  "canceled tiktok order excluded",
  !hoodie.contributingOrderKeys.includes("tiktok:TT-88104"),
  hoodie.contributingOrderKeys,
);
check(
  "pending-match amazon order excluded",
  !hoodie.contributingOrderKeys.includes("amazon:114-9910233-7781004"),
  hoodie.contributingOrderKeys,
);

console.log("\n== 2. Alert detection ==");
const alerts = detectAlerts(products, orders, DEMO_NOW);
// 1 shortage + 2 overdue: the ebay hoodie order (due today 12:00 vs a 14:00
// demo clock) and the amazon tee order (due yesterday).
check("exactly 3 alerts", alerts.length === 3, alerts.map((a) => a.id));
const shortage = alerts.find((a) => a.id === "shortage:HOODIE-BLK-M");
check("shortage alert exists", !!shortage);
check("shortage lists 3 orders", shortage?.relatedOrderKeys.length === 3, shortage?.relatedOrderKeys);
check("shortage offers 2 actions", shortage?.suggestedActions.length === 2);
check(
  "shortage actions are message + restock",
  shortage?.suggestedActions[0].type === "message_customer" &&
    shortage?.suggestedActions[1].type === "adjust_inventory",
);
check(
  "restock delta equals the 1-unit gap",
  shortage?.suggestedActions[1].type === "adjust_inventory" &&
    shortage.suggestedActions[1].delta === 1,
);
const overdues = alerts.filter((a) => a.kind === "overdue_shipment");
check("two overdue alerts", overdues.length === 2, overdues.map((a) => a.id));
check(
  "amazon tee order is overdue",
  overdues.some((a) => a.relatedOrderKeys[0] === "amazon:114-2288371-5540122"),
  overdues.map((a) => a.relatedOrderKeys),
);
check(
  "ebay hoodie order is overdue",
  overdues.some((a) => a.relatedOrderKeys[0] === "ebay:07-13345-99210"),
  overdues.map((a) => a.relatedOrderKeys),
);
check("both overdue are 'warning' severity (<48h)", overdues.every((a) => a.severity === "warning"), overdues.map((a) => a.severity));
check("no overdue alert for a canceled order", !overdues.some((a) => a.relatedOrderKeys[0] === "tiktok:TT-88104"));
check("shipped/delivered orders raise no alert", !alerts.some((a) => a.relatedOrderKeys.includes("shopify:1039")));

console.log("\n== 3. Low stock ==");
const snaps = snapshotAll(products, orders);
const low = snaps.filter(isLow);
check("exactly 1 product running low", low.length === 1, low.map((s) => s.sku));
check("low product is TEE-WHT-M with 1 left", low[0]?.sku === "TEE-WHT-M" && low[0]?.available === 1, low[0]);
check("oversold SKU is not counted as 'low'", !low.some((s) => s.sku === "HOODIE-BLK-M"));

console.log("\n== 4. Identity + duplicate detection ==");
check("order key normalizes case and whitespace", orderKey("shopify", "  1042 ") === "shopify:1042");
const dupe = structuredClone(orders.find((o) => o.key === "shopify:1042")!);
dupe.revisions = [new Date().toISOString()];
const after = upsertOrder(orders, dupe);
check("re-import updates rather than creates", after.result === "updated", after.result);
check("order count unchanged", after.orders.length === orders.length, after.orders.length);
check(
  "revision history grew",
  after.orders.find((o) => o.key === "shopify:1042")!.revisions.length === 2,
);
const hoodieAfterDupe = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, after.orders);
check(
  "re-import does NOT double-deduct stock (still 6 committed)",
  hoodieAfterDupe.committed === 6,
  hoodieAfterDupe.committed,
);

console.log("\n== 5. Importing a genuinely new order ==");
const extracted: ExtractedOrder = {
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
};
const newOrder = toOrder(extracted, maps);
check("new order resolves both lines to SKUs", newOrder.lines.every((l) => l.matchStatus === "matched"), newOrder.lines);
const withNew = upsertOrder(orders, newOrder);
check("new order is created", withNew.result === "created");
const hoodieAfterNew = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, withNew.orders);
check("committed rises to 7", hoodieAfterNew.committed === 7, hoodieAfterNew.committed);
check("available drops to -2", hoodieAfterNew.available === -2, hoodieAfterNew.available);
const alertsAfterNew = detectAlerts(products, withNew.orders, DEMO_NOW);
const shortageAfterNew = alertsAfterNew.find((a) => a.id === "shortage:HOODIE-BLK-M");
check("shortage now lists 4 orders", shortageAfterNew?.relatedOrderKeys.length === 4, shortageAfterNew?.relatedOrderKeys.length);
check(
  "alert signature changed, so a handled alert re-opens",
  shortage!.signature !== shortageAfterNew!.signature,
  [shortage!.signature, shortageAfterNew!.signature],
);

console.log("\n== 6. Uncertain match confirm / reject ==");
const pendingMap = maps.find((m) => m.id === "lm-4")!;
check("seed has a pending amazon hoodie match", pendingMap.status === "pending" && pendingMap.confidence < 0.9);
const confirmed = maps.map((m) => (m.id === "lm-4" ? { ...m, status: "confirmed" as const } : m));
const reresolvedConfirm = reresolveOrders(orders, confirmed);
const amazonLine = reresolvedConfirm.find((o) => o.key === "amazon:114-9910233-7781004")!.lines[0];
check("confirming flips the line to matched", amazonLine.matchStatus === "matched" && amazonLine.sku === "HOODIE-BLK-M", amazonLine);
const hoodieConfirmed = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, reresolvedConfirm);
check("confirming adds its unit to committed (7)", hoodieConfirmed.committed === 7, hoodieConfirmed.committed);

const rejected = maps.map((m) => (m.id === "lm-4" ? { ...m, status: "rejected" as const } : m));
const reresolvedReject = reresolveOrders(orders, rejected);
const amazonLineRejected = reresolvedReject.find((o) => o.key === "amazon:114-9910233-7781004")!.lines[0];
check(
  "rejecting leaves it unmatched, NOT stuck in pending_review",
  amazonLineRejected.matchStatus === "unmatched" && amazonLineRejected.sku === null,
  amazonLineRejected,
);
const hoodieRejected = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, reresolvedReject);
check("rejecting holds no stock (still 6)", hoodieRejected.committed === 6, hoodieRejected.committed);

console.log("\n== 7. Re-resolution is idempotent ==");
const once = reresolveOrders(orders, maps);
const twice = reresolveOrders(once, maps);
check("running twice changes nothing", JSON.stringify(once) === JSON.stringify(twice));
const hoodieOnce = snapshotFor(products.find((p) => p.sku === "HOODIE-BLK-M")!, twice);
check("committed still 6 after double re-resolve", hoodieOnce.committed === 6, hoodieOnce.committed);

console.log("\n== 8. Deadlines ==");
// 2026-09-18 is a Friday; +2 business days must land on Tuesday 2026-09-22.
const fri = defaultShipBy("2026-09-18T09:00:00Z");
check("2 business days from Friday skips the weekend", fri.startsWith("2026-09-22"), fri);
check("deadline is set to 17:00 UTC", fri.endsWith("T17:00:00.000Z"), fri);
const unmatchedLine = resolveLine("amazon", "Totally Unknown Product", maps);
check("unknown listing resolves to unmatched", unmatchedLine.matchStatus === "unmatched" && unmatchedLine.sku === null);

console.log("\n== 9. Stock correction clears the shortage ==");
const corrected = products.map((p) =>
  p.sku === "HOODIE-BLK-M" ? { ...p, startingStock: p.startingStock + 1 } : p,
);
const hoodieCorrected = snapshotFor(corrected.find((p) => p.sku === "HOODIE-BLK-M")!, orders);
check("available returns to 0", hoodieCorrected.available === 0, hoodieCorrected.available);
const alertsCorrected = detectAlerts(corrected, orders, DEMO_NOW);
check("shortage alert stops being detected", !alertsCorrected.some((a) => a.kind === "insufficient_inventory"), alertsCorrected.map((a) => a.id));
check("both overdue alerts still stand", alertsCorrected.length === 2, alertsCorrected.map((a) => a.id));

console.log(`\n${"=".repeat(52)}`);
console.log(`${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAILURES:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("All deterministic invariants hold.");
