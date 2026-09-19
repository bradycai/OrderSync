import "./env";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { StoreDatabase } from "./database";

export const databasePath = process.env.DATABASE_PATH || fileURLToPath(new URL("../data/orderwatch.sqlite", import.meta.url));
export const db = new StoreDatabase(databasePath);
export const resetDb = () => db.reset();
export const nextId = (prefix: string) => `${prefix}_${randomUUID()}`;
