import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { StoreDatabase } from "../src/database";
import { SEED_ORDERS } from "@orderwatch/shared";

test("SQLite persists records, rolls back failures, and resets explicitly", () => {
  const dir = mkdtempSync(join(tmpdir(), "orderwatch-db-"));
  let db = new StoreDatabase(join(dir, "test.sqlite"));
  try {
    const initial = db.products[0].startingStock;
    db.write(t => { t.products[0].startingStock += 7; t.orders = []; });
    assert.throws(() => db.write(t => { t.products[0].startingStock = 900; throw new Error("failed"); }));
    assert.equal(db.products[0].startingStock, initial + 7);
    // A database constraint failure rolls back earlier table changes too.
    assert.throws(() => db.write(t => {
      t.products[0].startingStock = 1000;
      t.orders.push({ ...SEED_ORDERS[0], key: "one" }, { ...SEED_ORDERS[0], key: "two" });
    }));
    assert.equal(db.products[0].startingStock, initial + 7);
    db.close();
    db = new StoreDatabase(join(dir, "test.sqlite"));
    assert.equal(db.products[0].startingStock, initial + 7);
    assert.equal(db.orders.length, 0, "empty tables must not be reseeded on restart");
    db.reset();
    assert.equal(db.products[0].startingStock, initial);
    assert.ok(db.orders.length > 0);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("API imports, mappings, approvals, stock corrections and reset survive restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "orderwatch-api-"));
  let child: ReturnType<typeof spawn> | undefined;
  let base = "";
  async function start() {
    child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, DATABASE_PATH: join(dir, "api.sqlite"), API_PORT: "0", ANTHROPIC_API_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    base = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("API startup timed out")), 10000);
      child!.once("exit", code => { clearTimeout(timeout); reject(new Error(`API exited ${code}`)); });
      child!.stdout!.on("data", chunk => {
        const match = String(chunk).match(/OrderWatch API on :(\d+)/);
        if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}/api`); }
      });
    });
  }
  async function stop() { if (child && child.exitCode === null) { const done = once(child, "exit"); child.kill("SIGTERM"); await done; } }
  async function request(path: string, body?: unknown, expected = 200) {
    const response = await fetch(base + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  try {
    await start();
    const inventory = (await request("/inventory")).inventory;
    const sku = inventory[0].sku;
    const input = { channel: "shopify", channelOrderId: "persistence-test", customerName: "Test", customerEmail: "test@example.com", placedAt: "2026-09-01T00:00:00Z", lines: [{ listingTitle: "Persistence test garment", quantity: 100, sku }] };
    await request("/orders", input, 201);
    await request("/orders", input);
    await request("/orders", { ...input, channelOrderId: "bad", lines: [{ ...input.lines[0], sku: "missing" }] }, 400);
    const alert = (await request("/alerts")).alerts.find((a: any) => a.calculation?.sku === sku);
    assert.ok(alert);
    const draft = await request(`/alerts/${alert.id}/draft`, { resolution: "inventory_correction" }, 201);
    await request(`/actions/${draft.action.id}/approve`, { draft: "Approved stock correction" });
    const corrected = (await request("/inventory")).inventory.find((p: any) => p.sku === sku).startingStock;
    assert.ok(corrected > inventory[0].startingStock);
    await stop(); await start();
    const orders = (await request("/orders?q=persistence-test")).orders;
    assert.equal(orders.length, 1);
    assert.equal(orders[0].revisions.length, 2);
    assert.equal((await request("/actions")).actions[0].draft, "Approved stock correction");
    assert.equal((await request("/inventory")).inventory.find((p: any) => p.sku === sku).startingStock, corrected);
    await request(`/actions/${draft.action.id}/approve`, {}, 409);
    await request(`/actions/${draft.action.id}/dismiss`, {}, 409);
    const db = new StoreDatabase(join(dir, "api.sqlite"));
    assert.ok(db.listingMaps.some(m => m.listingTitle === "Persistence test garment" && m.sku === sku));
    db.close();
    await request("/demo/reset", {});
    await stop(); await start();
    assert.equal((await request("/orders?q=persistence-test")).orders.length, 0);
    assert.equal((await request("/actions")).actions.length, 0);
    assert.equal((await request("/inventory")).inventory.find((p: any) => p.sku === sku).startingStock, inventory[0].startingStock);
  } finally { await stop(); rmSync(dir, { recursive: true, force: true }); }
});
