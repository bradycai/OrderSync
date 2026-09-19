import { snapshotFor, type ActionRecord } from "@orderwatch/shared";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";

export const actionsRouter: Router = Router();

/** GET /api/actions — approval history. */
actionsRouter.get("/", (_req, res) => {
  res.json({ actions: db.actions, simulated: true });
});

const ApproveSchema = z.object({
  /** The founder's edited text. Whatever is here is what gets recorded. */
  draft: z.string().min(1).optional(),
});

/**
 * POST /api/actions/:id/approve
 *
 * Records the decision and nothing else. No email is sent, no marketplace is
 * called, no stock is silently rewritten — the response says so explicitly so
 * the UI cannot imply otherwise.
 */
actionsRouter.post("/:id/approve", (req, res) => {
  const parsed = ApproveSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid approval", detail: parsed.error.issues });
  }

  const outcome = db.write((tables) => {
    const action = tables.actions.find((a) => a.id === req.params.id);
    if (!action) return { status: 404, body: { error: `No action ${req.params.id}` } };
    if (action.status !== "pending_review") {
      return { status: 409, body: { error: `Action ${action.id} is already ${action.status}` } };
    }

    // An approved stock correction is the one action that changes real state —
    // and it changes starting stock, which is the only field an import never touches.
    let inventoryEffect: string | null = null;
    const proposed = action.action;
    if (proposed.type === "adjust_inventory") {
      const product = tables.products.find((p) => p.sku === proposed.sku);
      if (!product) {
        return { status: 404, body: { error: `No product ${proposed.sku}` } };
      }
      const snapshot = snapshotFor(product, tables.orders);
      if (proposed.expectedStartingStock === undefined || proposed.expectedCommitted === undefined ||
          snapshot.startingStock !== proposed.expectedStartingStock || snapshot.committed !== proposed.expectedCommitted) {
        return { status: 409, body: { error: "Inventory changed since this proposal. Close it and review a fresh correction." } };
      }
      product.startingStock += proposed.delta;
      inventoryEffect =
        `Starting stock for ${proposed.sku} changed by ` +
        `${proposed.delta >= 0 ? "+" : ""}${proposed.delta} → ${product.startingStock} (demo data only).`;
    }

    if (parsed.data.draft) action.draft = parsed.data.draft;
    action.status = "approved_simulated";
    action.decidedAt = new Date().toISOString();

    return { status: 200, body: {
      action,
      simulated: true,
      inventoryEffect,
      notice:
        "Recorded in this demo only. No customer email was sent and no marketplace was updated.",
    } };
  });
  res.status(outcome.status).json(outcome.body);
});

/** POST /api/actions/:id/dismiss — decline the suggestion. */
actionsRouter.post("/:id/dismiss", (req, res) => {
  const outcome = db.write((tables) => {
    const action: ActionRecord | undefined = tables.actions.find((a) => a.id === req.params.id);
    if (!action) return { status: 404, body: { error: `No action ${req.params.id}` } };
    if (action.status !== "pending_review") return { status: 409, body: { error: `Action ${action.id} is already ${action.status}` } };
    action.status = "dismissed";
    action.decidedAt = new Date().toISOString();
    return { status: 200, body: { action, simulated: true } };
  });
  res.status(outcome.status).json(outcome.body);
});
