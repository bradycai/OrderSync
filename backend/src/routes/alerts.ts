import {
  DEMO_NOW,
  detectAlerts,
  findOrder,
  type ActionRecord,
  type Alert,
  type AlertsResponse,
  type Resolution,
} from "@orderwatch/shared";
import { Router } from "express";
import { z } from "zod";
import { draftMessage } from "../ai";
import { db, nextId } from "../db";

export const alertsRouter: Router = Router();

/** Fixed clock keeps the demo reproducible — overdue orders stay overdue. */
const now = () => DEMO_NOW;

export const currentAlerts = (): Alert[] => detectAlerts(db.products, db.orders, now());

/* ------------------------------------------------------------------ *
 * GET /api/alerts — detection is deterministic; no model involved.
 * ------------------------------------------------------------------ */
alertsRouter.get("/", (_req, res) => {
  const alerts = currentAlerts();
  const keys = new Set(alerts.flatMap((a) => a.relatedOrderKeys));

  const body: AlertsResponse = {
    alerts,
    supportingOrders: db.orders.filter((o) => keys.has(o.key)),
    generatedAt: new Date().toISOString(),
  };
  res.json(body);
});

/* ------------------------------------------------------------------ *
 * POST /api/alerts/:id/draft — AI-written message for the chosen fix.
 * Creates a pending action; nothing is sent until it is approved.
 * ------------------------------------------------------------------ */
const DraftSchema = z.object({
  resolution: z.enum([
    "delay_and_apologize",
    "offer_refund",
    "partial_shipment",
    "cancel_and_refund",
    "inventory_correction",
  ]),
  orderKey: z.string().optional(),
});

alertsRouter.post("/:id/draft", async (req, res) => {
  const parsed = DraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid draft request", detail: parsed.error.issues });
  }
  const { resolution, orderKey } = parsed.data as { resolution: Resolution; orderKey?: string };

  const alert = currentAlerts().find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: `No open alert ${req.params.id}` });

  // Default to whichever order the alert itself nominated.
  const targetKey =
    orderKey ??
    (alert.suggestedAction.type === "message_customer"
      ? alert.suggestedAction.orderKey
      : alert.relatedOrderKeys[0]);

  const order = findOrder(db.orders, targetKey);
  if (!order) return res.status(404).json({ error: `No order ${targetKey}` });
  if (!alert.relatedOrderKeys.includes(order.key)) {
    return res.status(400).json({ error: `Order ${order.key} is not part of alert ${alert.id}` });
  }

  if (resolution === "inventory_correction" && !alert.calculation) {
    return res.status(400).json({ error: "Stock corrections require an inventory shortage." });
  }
  try {
    const draft = resolution === "inventory_correction"
      ? { subject: "Review inventory correction", body: "Correct the demo stock count after verifying physical inventory.", demoMode: false }
      : await draftMessage(alert, order, resolution);

    const record: ActionRecord = {
      id: nextId("act"),
      alertId: alert.id,
      action:
        resolution === "inventory_correction" && alert.calculation
          ? {
              type: "adjust_inventory",
              sku: alert.calculation.sku,
              delta: Math.abs(alert.calculation.available),
              expectedStartingStock: alert.calculation.startingStock,
              expectedCommitted: alert.calculation.committed,
              label: `Add ${Math.abs(alert.calculation.available)} to ${alert.calculation.sku}`,
            }
          : { type: "message_customer", orderKey: order.key, label: alert.suggestedAction.label },
      draft: draft.body,
      status: "pending_review",
    };
    db.write((tables) => { tables.actions.push(record); });

    res.status(201).json({
      action: record,
      subject: draft.subject,
      order,
      resolution,
      demoMode: draft.demoMode,
      simulated: true,
      notice: "Draft only. Nothing is sent until you approve, and approval is simulated.",
    });
  } catch (err) {
    res.status(502).json({ error: `Drafting failed: ${(err as Error).message}` });
  }
});
