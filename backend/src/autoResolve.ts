import { aiFailureReason } from "./aiErrors";
import { randomUUID } from "node:crypto";
import { autoResolveReason, detectAlerts, type Alert, type Order } from "@orderwatch/shared";
import type { StoreDatabase } from "./database";

type Draft = (alert: Alert, order: Order) => Promise<{ body: string; demoMode: boolean }>;
export async function autoResolveWarnings(db: StoreDatabase, now: Date, draft: Draft) {
  const alerts = detectAlerts(db.products, db.orders, now);
  const results: { alertId: string; title: string; status: "handled" | "skipped" | "failed"; reason: string; draft?: string; demoMode?: boolean }[] = [];
  for (const alert of alerts) {
    const reason = autoResolveReason(alert, alerts, db.orders, db.actions);
    if (reason) { results.push({ alertId: alert.id, title: alert.title, status: "skipped", reason }); continue; }
    const order = db.orders.find(o => o.key === alert.relatedOrderKeys[0])!;
    const original = JSON.stringify(order);
    try {
      const message = await draft(alert, order);
      if (!message.body.trim()) throw new Error("AI returned an empty message.");
      const saved = db.write(tables => {
        const current = detectAlerts(tables.products, tables.orders, now);
        const fresh = current.find(a => a.id === alert.id);
        if (!fresh || JSON.stringify(tables.orders.find(o => o.key === order.key)) !== original) return false;
        if (autoResolveReason(fresh, current, tables.orders, tables.actions)) return false;
        tables.actions.push({
          id: `auto-${randomUUID()}`, alertId: alert.id,
          action: { type: "message_customer", orderKey: order.key, label: "AI warning follow-up (simulated)" },
          draft: message.body, status: "approved_simulated", decidedAt: new Date().toISOString(),
          automation: { source: "warning_assistant", demoMode: message.demoMode, orderSnapshot: original, alertTitle: alert.title },
        });
        return true;
      });
      results.push({ alertId: alert.id, title: alert.title, status: saved ? "handled" : "skipped", reason: saved ? "Warning resolved in the demo queue. No email sent; shipment still requires fulfillment." : "Issue changed or was handled while AI was working.", ...(saved ? { draft: message.body, demoMode: message.demoMode } : {}) });
    } catch (error) {
      results.push({ alertId: alert.id, title: alert.title, status: "failed", reason: aiFailureReason(error) });
    }
  }
  return { simulated: true as const, results };
}
