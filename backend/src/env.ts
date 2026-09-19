import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Imported for its side effect, and imported *first* by index.ts.
 *
 * ESM evaluates every import before the importing module's own statements, so
 * calling dotenv.config() in the body of index.ts would run too late for any
 * module that reads process.env at load time (e.g. SESSION_DAYS in ./auth/sessions).
 *
 * .env lives at the repo root so backend and frontend read the same file.
 */
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
