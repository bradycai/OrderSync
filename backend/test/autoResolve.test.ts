import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_NOW, detectAlerts } from "@orderwatch/shared";
import { StoreDatabase } from "../src/database";
import { autoResolveWarnings } from "../src/autoResolve";

function setup() {
  const db = new StoreDatabase(":memory:");
  db.write(t => {
    t.orders = [{ ...t.orders[0], key: "shopify:warning-test", channelOrderId: "warning-test", shipBy: new Date(+DEMO_NOW - 12 * 3600000).toISOString(),
      lines: [{ listingTitle: "Navy cap", quantity: 1, sku: "CAP-NVY-OS", matchStatus: "matched" }] }];
  });
  return db;
}
const draft = async () => ({ body: "Sorry for the delay. We’re checking your order and will follow up.", demoMode: true });

test("warning follow-ups are simulated, persistent, and idempotent", async () => {
  const db = setup();
  try {
    const before = JSON.stringify({ products: db.products, orders: db.orders });
    const result = await autoResolveWarnings(db, DEMO_NOW, draft);
    assert.equal(result.results[0].status, "handled");
    assert.equal(db.actions[0].automation?.demoMode, true);
    assert.equal(db.actions[0].status, "approved_simulated");
    assert.equal(JSON.stringify({ products: db.products, orders: db.orders }), before);
    await autoResolveWarnings(db, DEMO_NOW, async () => { throw new Error("Must not call AI again"); });
    assert.equal(db.actions.length, 1);
    assert.equal(detectAlerts(db.products, db.orders, DEMO_NOW).length, 1, "physical problem remains visible");
  } finally { db.close(); }
});

test("critical, linked shortage, uncertain and pending-review cases never call AI", async () => {
  for (const kind of ["critical", "shortage", "uncertain", "pending"] as const) {
    const db = setup();
    try {
      db.write(t => {
        if (kind === "critical") t.orders[0].shipBy = new Date(+DEMO_NOW - 72 * 3600000).toISOString();
        if (kind === "shortage") t.orders[0].lines[0].quantity = 100;
        if (kind === "uncertain") t.orders[0].lines[0].matchStatus = "pending_review";
        if (kind === "pending") t.actions.push({ id: "manual", alertId: "overdue:shopify:warning-test", status: "pending_review", draft: "Manual draft", action: { type: "message_customer", orderKey: t.orders[0].key, label: "Review" } });
      });
      let calls = 0;
      const result = await autoResolveWarnings(db, DEMO_NOW, async () => { calls++; return draft(); });
      assert.equal(calls, 0, kind);
      assert.ok(result.results.every(r => r.status === "skipped"));
    } finally { db.close(); }
  }
});

test("AI failure leaves warnings untouched and retryable", async () => {
  const db = setup();
  try {
    const result = await autoResolveWarnings(db, DEMO_NOW, async () => { throw new Error("Unavailable"); });
    assert.equal(result.results[0].status, "failed");
    assert.equal(db.actions.length, 0);
    assert.equal((await autoResolveWarnings(db, DEMO_NOW, draft)).results[0].status, "handled");
  } finally { db.close(); }
});

test("rechecks severity and order state after generation", async () => {
  const db = setup();
  try {
    const result = await autoResolveWarnings(db, DEMO_NOW, async () => {
      db.write(t => { t.orders[0].lines[0].quantity = 100; });
      return draft();
    });
    assert.equal(result.results[0].status, "skipped");
    assert.equal(db.actions.length, 0);
  } finally { db.close(); }
});

test("concurrent runs record at most one follow-up", async () => {
  const db = setup();
  try {
    await Promise.all([autoResolveWarnings(db, DEMO_NOW, draft), autoResolveWarnings(db, DEMO_NOW, draft)]);
    assert.equal(db.actions.length, 1);
  } finally { db.close(); }
});

test("resolved warnings leave active queue but reopen on changed orders or critical risk", async () => {
  const { activeAlerts } = await import("@orderwatch/shared");
  const db = setup();
  const active = () => activeAlerts(detectAlerts(db.products, db.orders, DEMO_NOW), db.orders, db.actions);
  try {
    await autoResolveWarnings(db, DEMO_NOW, draft);
    assert.equal(active().length, 0);
    assert.equal(db.actions.length, 1);
    db.write(t => { t.orders[0].lines[0].quantity = 2; });
    assert.equal(active().length, 1);
    assert.equal((await autoResolveWarnings(db, DEMO_NOW, draft)).results[0].status, "handled");
    assert.equal(active().length, 0);
    db.write(t => { t.products.find(p => p.sku === "CAP-NVY-OS")!.startingStock = 0; });
    assert.equal(active().length, 2, "critical shortage restores the linked overdue warning too");
  } finally { db.close(); }
});
