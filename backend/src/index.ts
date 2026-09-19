import "./env";
import express, { type NextFunction, type Request, type Response } from "express";
import type { DemoStatus } from "@orderwatch/shared";
import { isDemoMode } from "./ai";
import { MODEL } from "./claude";
import { db, databasePath, resetDb } from "./db";
import { actionsRouter } from "./routes/actions";
import { alertsRouter } from "./routes/alerts";
import { inventoryRouter } from "./routes/inventory";
import { ordersRouter } from "./routes/orders";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * Demo status. `simulated` is always true: this server never contacts a
 * marketplace or sends an email, and no endpoint should imply otherwise.
 */
app.get("/api/status", (_req, res) => {
  const body: DemoStatus = { demoMode: isDemoMode(), model: MODEL, simulated: true };
  res.json(body);
});

app.use("/api/orders", ordersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/actions", actionsRouter);

/** Back to the seeded state — orders, stock, mappings, and history. */
app.post("/api/demo/reset", (_req, res) => {
  resetDb();
  res.json({ ok: true, message: "Demo data reset to the seeded state." });
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = Number(process.env.API_PORT ?? 8787);
const server = app.listen(port, () => {
  console.log(`SQLite database: ${databasePath}`);
  console.log(
    `OrderWatch API on :${(server.address() as { port: number }).port} — ${
      isDemoMode() ? "DEMO MODE (no ANTHROPIC_API_KEY)" : `live model (${MODEL})`
    }`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
