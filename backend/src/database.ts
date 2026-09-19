import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SEED_LISTING_MAPS, SEED_ORDERS, SEED_PRODUCTS, type ActionRecord, type ListingMap, type Order, type Product } from "@orderwatch/shared";

export interface Tables {
  products: Product[];
  orders: Order[];
  listingMaps: ListingMap[];
  actions: ActionRecord[];
}
const tableNames = ["products", "orders", "listingMaps", "actions"] as const;
const keyOf = (row: Product | Order | ListingMap | ActionRecord): string =>
  "key" in row ? row.key : "id" in row ? row.id : row.sku;

/** SQLite is authoritative; reads return detached records, writes must use write(). */
export class StoreDatabase {
  private connection: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.connection = new DatabaseSync(path);
    this.connection.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const version = this.connection.prepare("PRAGMA user_version").get()!.user_version as number;
      if (version > 1) throw new Error(`Unsupported database version ${version}`);
      if (version === 0) {
        // Each domain record has its own keyed row; nested order lines remain JSON.
        for (const table of tableNames) {
          this.connection.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL CHECK(json_valid(data))) STRICT`);
        }
        this.connection.exec(`CREATE UNIQUE INDEX order_identity ON orders(json_extract(data, '$.channel'), json_extract(data, '$.channelOrderId'))`);
        this.connection.exec("PRAGMA user_version = 1");
        this.save(this.seed());
      }
      this.connection.exec("COMMIT");
    } catch (error) {
      this.connection.exec("ROLLBACK");
      this.connection.close();
      throw error;
    }
  }

  private seed(): Tables {
    return structuredClone({ products: SEED_PRODUCTS, orders: SEED_ORDERS, listingMaps: SEED_LISTING_MAPS, actions: [] });
  }
  private read<K extends keyof Tables>(table: K): Tables[K] {
    return this.connection.prepare(`SELECT data FROM ${table} ORDER BY rowid ${table === "actions" ? "DESC" : "ASC"}`)
      .all().map(row => JSON.parse(row.data as string)) as Tables[K];
  }
  get products() { return this.read("products"); }
  get orders() { return this.read("orders"); }
  get listingMaps() { return this.read("listingMaps"); }
  get actions() { return this.read("actions"); }

  private save(tables: Tables): void {
    for (const table of tableNames) {
      const existing = new Map(this.connection.prepare(`SELECT id, data FROM ${table}`).all().map(row => [row.id as string, row.data as string]));
      const put = this.connection.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`);
      for (const row of tables[table]) {
        const id = keyOf(row);
        const data = JSON.stringify(row);
        if (existing.get(id) !== data) put.run(id, data);
        existing.delete(id);
      }
      const remove = this.connection.prepare(`DELETE FROM ${table} WHERE id = ?`);
      for (const id of existing.keys()) remove.run(id);
    }
  }

  /** Synchronous callback keeps related changes in one transaction, with rollback on failure. */
  write<T>(change: (tables: Tables) => T): T {
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const tables: Tables = { products: this.products, orders: this.orders, listingMaps: this.listingMaps, actions: this.actions };
      const result = change(tables);
      if (result instanceof Promise) throw new Error("Database writes must be synchronous");
      this.save(tables);
      this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }
  reset(): void { this.write(tables => Object.assign(tables, this.seed())); }
  close(): void { this.connection.close(); }
}
