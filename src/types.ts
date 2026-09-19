/** Core domain model for OrderWatch. All data in this prototype is synthetic. */

export type Channel = "shopify" | "tiktok" | "amazon" | "ebay";

export const CHANNELS: Channel[] = ["shopify", "tiktok", "amazon", "ebay"];

export const CHANNEL_LABELS: Record<Channel, string> = {
  shopify: "Shopify",
  tiktok: "TikTok Shop",
  amazon: "Amazon",
  ebay: "eBay",
};

/** Deterministic lifecycle. Canceled orders never hold committed stock. */
export type OrderStatus = "awaiting_shipment" | "shipped" | "delivered" | "canceled";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_shipment: "Awaiting shipment",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

/** A product we actually hold stock for, keyed by our own SKU. */
export interface Product {
  sku: string;
  title: string;
  color: string;
  size: string;
  /** Physical units on hand before any order commitments are applied. */
  startingStock: number;
}

/**
 * A marketplace listing title mapped to one of our SKUs.
 * `pending` matches are proposed (often by AI) and excluded from stock math
 * until the founder confirms them.
 */
export interface ListingMap {
  id: string;
  channel: Channel;
  listingTitle: string;
  sku: string;
  confidence: number; // 0..1
  status: "confirmed" | "pending" | "rejected";
  /** Where the mapping came from, so the UI can label AI suggestions. */
  source: "seed" | "ai" | "manual";
  /** Model rationale, shown to the founder when confirming an uncertain match. */
  reasoning?: string;
}

export interface OrderLine {
  listingTitle: string;
  quantity: number;
  /** null while the listing has not been resolved to one of our SKUs. */
  sku: string | null;
  matchStatus: "matched" | "pending_review" | "unmatched";
}

export interface Order {
  /** Stable identity = channel + marketplace order id. Used for dedupe. */
  key: string;
  channel: Channel;
  channelOrderId: string;
  customerName: string;
  customerEmail: string;
  placedAt: string; // ISO
  shipBy: string; // ISO — deterministic deadline
  status: OrderStatus;
  lines: OrderLine[];
  source: "seed" | "email_import";
  /** ISO timestamps of every notification that touched this order. */
  revisions: string[];
}

export type AlertKind = "insufficient_inventory" | "overdue_shipment";

export interface InventorySnapshot {
  sku: string;
  startingStock: number;
  committed: number;
  available: number;
  /** Order keys contributing to `committed`. */
  contributingOrderKeys: string[];
}

export interface Alert {
  id: string;
  /**
   * Content fingerprint. Approving an action resolves the alert *as it stood*;
   * if the underlying numbers move afterwards the signature changes and the
   * alert correctly returns to the queue.
   */
  signature: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  title: string;
  /** Plain-language reason the founder can read. */
  explanation: string;
  /** Deterministic math shown alongside the alert. */
  calculation?: InventorySnapshot;
  relatedOrderKeys: string[];
  /** First entry is the recommended action; the rest are alternatives. */
  suggestedActions: SuggestedAction[];
}

export type SuggestedAction =
  | {
      type: "message_customer";
      orderKey: string;
      label: string;
      description: string;
    }
  | {
      type: "adjust_inventory";
      sku: string;
      delta: number;
      label: string;
      description: string;
    };

/** Every approval is simulated — nothing leaves this machine. */
export interface ActionRecord {
  id: string;
  alertId: string;
  /** Signature of the alert at the moment this action was raised. */
  alertSignature: string;
  action: SuggestedAction;
  /** Editable draft the founder reviews before approving (message actions). */
  subject: string;
  draft: string;
  /** Editable stock correction the founder reviews (inventory actions). */
  proposedDelta?: number;
  /** True when the draft came from prepared sample output, not a live model. */
  demoMode: boolean;
  status: "pending_review" | "approved_simulated" | "dismissed";
  createdAt: string;
  decidedAt?: string;
}

/** Manual vs assisted reconciliation timing, recorded during a live demo. */
export interface TimingRun {
  id: string;
  mode: "manual" | "assisted";
  label: string;
  startedAt: string;
  endedAt?: string;
  seconds?: number;
}

export interface ExtractedOrder {
  channel: Channel;
  channelOrderId: string;
  customerName: string;
  customerEmail: string;
  placedAt: string;
  shipBy: string | null;
  status: OrderStatus;
  lines: { listingTitle: string; quantity: number }[];
  /** Set by the server when AI credentials are missing. */
  demoMode?: boolean;
  notes?: string;
}

export interface MatchSuggestion {
  sku: string | null;
  confidence: number;
  reasoning: string;
  demoMode?: boolean;
}

export interface DraftMessage {
  subject: string;
  body: string;
  demoMode?: boolean;
}

/** Transient confirmation shown after a simulated action. */
export interface Toast {
  id: string;
  title: string;
  body?: string;
  /** `simulated` renders the explicit "no external action" label. */
  tone: "simulated" | "info";
}
