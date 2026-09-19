import { test } from "node:test";
import assert from "node:assert/strict";
import { SEED_ORDERS, SEED_PRODUCTS, DEMO_NOW, detectAlerts, autoResolveReason, snapshotFor } from "@orderwatch/shared";
import { EXTRA_ORDERS } from "../../shared/src/extraSeed";

test("expanded demo preserves the hoodie example and adds diverse actionable orders", () => {
  assert.equal(EXTRA_ORDERS.length, 30);
  assert.equal(SEED_ORDERS.length, 38);
  assert.equal(new Set(SEED_ORDERS.map(o => o.key)).size, 38);
  assert.equal(new Set(EXTRA_ORDERS.map(o => o.channel)).size, 4);
  assert.equal(new Set(EXTRA_ORDERS.map(o => o.status)).size, 4);
  assert.ok(EXTRA_ORDERS.every(o => Date.parse(o.placedAt) < Date.parse(o.shipBy)));
  const hoodie = snapshotFor(SEED_PRODUCTS.find(p => p.sku === "HOODIE-BLK-M")!, SEED_ORDERS);
  assert.equal(hoodie.available, -1);
  assert.equal(hoodie.contributingOrderKeys.length, 3);
  const alerts = detectAlerts(SEED_PRODUCTS, SEED_ORDERS, DEMO_NOW);
  assert.equal(alerts.filter(a => a.severity === "critical").length, 4);
  assert.equal(alerts.filter(a => !autoResolveReason(a, alerts, SEED_ORDERS, [])).length, 7);
});
