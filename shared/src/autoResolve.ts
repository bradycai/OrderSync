import type { ActionRecord, Alert, Order } from "./types";

/** The model cannot override this allowlist. */
export function autoResolveReason(alert: Alert, alerts: Alert[], orders: Order[], actions: ActionRecord[]): string | null {
  if (alert.severity === "critical") return "Critical issue — manual review required.";
  if (alert.kind !== "overdue_shipment") return "This issue requires a manual decision.";
  if (alert.relatedOrderKeys.some(key => alerts.some(a => a.severity === "critical" && a.relatedOrderKeys.includes(key)))) return "A related order has a critical issue.";
  const related = orders.filter(o => alert.relatedOrderKeys.includes(o.key));
  if (related.length !== 1 || related[0].status !== "awaiting_shipment") return "Order needs manual review.";
  if (related[0].lines.some(l => l.matchStatus !== "matched")) return "Confirm product matches first.";
  if (actions.some(a => a.alertId === alert.id && (a.status === "pending_review" || (a.status === "approved_simulated" && (!a.automation || a.automation.orderSnapshot === JSON.stringify(related[0])))))) return "Already handled or awaiting your review.";
  return null;
}

/** Only suppress a resolved warning while its order and risk remain unchanged. */
export function activeAlerts(alerts: Alert[], orders: Order[], actions: ActionRecord[]): Alert[] {
  return alerts.filter(alert => {
    if (autoResolveReason(alert, alerts, orders, [])) return true;
    const order = orders.find(o => alert.relatedOrderKeys.includes(o.key));
    return !actions.some(action => action.alertId === alert.id && action.status === "approved_simulated" &&
      action.automation?.orderSnapshot === JSON.stringify(order));
  });
}
