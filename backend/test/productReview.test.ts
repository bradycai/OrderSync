import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import { snapshotFor } from "@orderwatch/shared";
import { StoreDatabase } from "../src/database";
import { confirmProductMatch, pendingReviews } from "../src/productReview";

test("match review handles alternative SKUs, canceled orders, and repeat confirmation", () => {
  const db = new StoreDatabase(":memory:");
  try {
    const pending = pendingReviews(db)[0];
    assert.ok(pending);
    const sku = "HOODIE-BLK-L";
    const initial = snapshotFor(db.products.find(p => p.sku === sku)!, db.orders).committed;
    db.write(t => {
      const original = t.orders.find(o => o.key === pending.orderKeys[0])!;
      t.orders.push({ ...structuredClone(original), key: "canceled-test", channelOrderId: "canceled-test", status: "canceled" });
    });
    db.write(t => confirmProductMatch(t, pending.channel, pending.listingTitle, sku));
    assert.equal(snapshotFor(db.products.find(p => p.sku === sku)!, db.orders).committed, initial + 1);
    assert.equal(pendingReviews(db).length, 0);
    assert.throws(() => db.write(t => confirmProductMatch(t, pending.channel, pending.listingTitle, sku)));
    assert.throws(() => db.write(t => confirmProductMatch(t, pending.channel, pending.listingTitle, "unknown")));
  } finally { db.close(); }
});

test("review endpoints confirm pending imports and reject stale stock corrections", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orderwatch-review-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  // Inventory corrections must not call AI even with credentials configured.
  process.env.ANTHROPIC_API_KEY = "test-no-network";
  const { db } = await import("../src/db");
  const { inventoryRouter } = await import("../src/routes/inventory");
  const { alertsRouter } = await import("../src/routes/alerts");
  const { actionsRouter } = await import("../src/routes/actions");
  const { ordersRouter } = await import("../src/routes/orders");
  const app = express();
  app.use(express.json());
  app.use("/inventory", inventoryRouter);
  app.use("/alerts", alertsRouter);
  app.use("/actions", actionsRouter);
  app.use("/orders", ordersRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function call(path: string, body?: unknown, status = 200) {
    const response = await fetch(base + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    assert.equal(response.status, status, JSON.stringify(result));
    return result;
  }
  try {
    const match = (await call("/inventory/matches")).matches[0];
    await call("/inventory/matches/confirm", { ...match, sku: "missing" }, 400);
    await call("/inventory/matches/confirm", { ...match, sku: "HOODIE-BLK-L" });
    await call("/inventory/matches/confirm", { ...match, sku: "HOODIE-BLK-L" }, 409);
    const listingTitle = "Heavyweight Hoodie — Black / M";
    const input = { channel: "shopify", channelOrderId: "pending-test", customerName: "Test", customerEmail: "test@example.com", placedAt: "2026-09-19T10:00:00Z", lines: [{ listingTitle, quantity: 1, sku: null }] };
    const imported = await call("/orders", input, 201);
    assert.equal(imported.order.lines[0].matchStatus, "pending_review");
    await call("/inventory/matches/confirm", { channel: "shopify", listingTitle, sku: "HOODIE-BLK-L" });
    assert.equal(db.orders.find(o => o.channelOrderId === "pending-test")!.lines[0].sku, "HOODIE-BLK-L");
    assert.equal(db.orders.find(o => o.channelOrderId === "1042")!.lines[0].sku, "HOODIE-BLK-M", "confirmed lines must not be rewritten");
    const alerts = (await call("/alerts")).alerts;
    const shortage = alerts.find((a: any) => a.calculation?.sku === "HOODIE-BLK-M");
    const overdue = alerts.find((a: any) => a.kind === "overdue_shipment");
    await call(`/alerts/${encodeURIComponent(overdue.id)}/draft`, { resolution: "inventory_correction" }, 400);
    const path = `/alerts/${encodeURIComponent(shortage.id)}/draft`;
    const first = await call(path, { resolution: "inventory_correction" }, 201);
    const second = await call(path, { resolution: "inventory_correction" }, 201);
    assert.equal(first.action.action.expectedStartingStock, 5);
    assert.equal(first.action.action.delta, 1);
    await call(`/actions/${first.action.id}/approve`, {});
    await call(`/actions/${second.action.id}/approve`, {}, 409);
    await call(`/actions/${first.action.id}/approve`, {}, 409);
    assert.equal(db.products.find(p => p.sku === "HOODIE-BLK-M")!.startingStock, 6);
    assert.equal(db.actions.find(a => a.id === second.action.id)!.status, "pending_review");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close(); rmSync(dir, { recursive: true, force: true });
  }
});
