import { STATUS_LABELS, type OrderStatus } from "../types";
import { Pill } from "./ui";

/** Canceled is muted rather than red — it is a fact, not a problem. */
const TONE: Record<OrderStatus, "amber" | "emerald" | "neutral" | "muted"> = {
  awaiting_shipment: "amber",
  shipped: "emerald",
  delivered: "neutral",
  canceled: "muted",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <Pill tone={TONE[status]}>
      {status === "canceled" && <span className="line-through">{STATUS_LABELS[status]}</span>}
      {status !== "canceled" && STATUS_LABELS[status]}
    </Pill>
  );
}
