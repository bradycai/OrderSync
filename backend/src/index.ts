import "./env";
import cookieParser from "cookie-parser";
import { authRoutes } from "./auth/routes";
import { requireAuth } from "./auth/middleware";
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
app.use(cookieParser());

app.use("/api/auth", authRoutes);

/**
 * Demo status. `simulated` is always true: this server never contacts a
 * marketplace or sends an email, and no endpoint should imply otherwise.
 */
app.get("/api/status", (_req, res) => {
  const body: DemoStatus = { demoMode: isDemoMode(), model: MODEL, simulated: true };
  res.json(body);
});

// Auth and status remain public; operational data requires a session.
app.use("/api", requireAuth);

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
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;

  console.log(`SQLite database: ${databasePath}`);
  console.log(
    `OrderWatch API on :${actualPort} — ${
      isDemoMode() ? "DEMO MODE (no ANTHROPIC_API_KEY)" : `live model (${MODEL})`
    }`,
  );
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the active process or set API_PORT to a different value.`);
    process.exit(1);
  }

  throw error;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
