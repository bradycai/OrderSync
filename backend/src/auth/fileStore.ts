import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Everything the auth layer persists lives here. Gitignored — it holds hashes. */
const DATA_DIR = process.env.AUTH_DATA_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../data");

/**
 * A JSON array on disk, standing in for a database table.
 * Swapping this file for SQLite is the only change a real store would need.
 */
export function jsonTable<T>(filename: string) {
  const path = resolve(DATA_DIR, filename);

  async function readAll(): Promise<T[]> {
    try {
      const raw = await readFile(path, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      // Missing or unreadable file means "no rows yet", not an error.
      return [];
    }
  }

  /** Write to a temp file then rename, so a crash mid-write cannot truncate the store. */
  async function writeAll(rows: T[]): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
    await rename(tmp, path);
  }

  return { readAll, writeAll };
}
