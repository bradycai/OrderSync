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
  kind: AlertKind;
  severity: "critical" | "warning";
  title: string;
  /** Plain-language reason the founder can read. */
  explanation: string;
  /** Deterministic math shown alongside the alert. */
  calculation?: InventorySnapshot;
  relatedOrderKeys: string[];
  suggestedAction: SuggestedAction;
}

export type SuggestedAction =
  | { type: "message_customer"; orderKey: string; label: string }
  | { type: "adjust_inventory"; sku: string; delta: number; label: string; expectedStartingStock?: number; expectedCommitted?: number }
  | { type: "confirm_match"; listingMapId: string; label: string };

/** Every approval is simulated — nothing leaves this machine. */
export interface ActionRecord {
  id: string;
  alertId: string;
  action: SuggestedAction;
  /** Editable draft the founder reviews before approving. */
  draft: string;
  status: "pending_review" | "approved_simulated" | "dismissed";
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

/* ------------------------------------------------------------------ *
 * API contract — shared between the Express routes and the UI client.
 * ------------------------------------------------------------------ */

export interface OrderFilters {
  channel?: Channel;
  status?: OrderStatus;
  /** Matches order id, customer name, or listing title. */
  q?: string;
}

/** A line in an import preview, before the founder has confirmed anything. */
export interface PreviewLine {
  listingTitle: string;
  quantity: number;
  sku: string | null;
  matchStatus: OrderLine["matchStatus"];
  /** Present when no confirmed mapping existed and the model proposed one. */
  suggestion?: {
    sku: string | null;
    confidence: number;
    reasoning: string;
    /** True when confidence is below the auto-accept bar. */
    needsConfirmation: boolean;
  };
}

/** Response of POST /api/orders/parse-email. Nothing is saved yet. */
export interface ParsePreview {
  extracted: ExtractedOrder;
  key: string;
  /** "update" means an order with this channel + id already exists. */
  willResult: "create" | "update";
  existing: Order | null;
  lines: PreviewLine[];
  demoMode: boolean;
  warnings: string[];
}

/** Body of POST /api/orders — the reviewed, confirmed order. */
export interface ConfirmedOrderInput {
  channel: Channel;
  channelOrderId: string;
  customerName: string;
  customerEmail: string;
  placedAt: string;
  shipBy?: string | null;
  status?: OrderStatus;
  lines: {
    listingTitle: string;
    quantity: number;
    /** Set when the founder accepted a suggested match. */
    sku?: string | null;
  }[];
}

export interface InventoryRow extends InventorySnapshot {
  title: string;
  color: string;
  size: string;
  /** Deterministic flags the UI renders directly. */
  isShort: boolean;
  isLow: boolean;
  mappedChannels: Channel[];
}

/** GET /api/alerts — alerts plus the records that justify them. */
export interface AlertsResponse {
  alerts: Alert[];
  /** Every order referenced by an alert, so the UI needs no second request. */
  supportingOrders: Order[];
  generatedAt: string;
}

/** How the founder chose to resolve an alert. Drives the drafted message. */
export type Resolution =
  | "delay_and_apologize"
  | "offer_refund"
  | "partial_shipment"
  | "cancel_and_refund"
  | "inventory_correction";

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  delay_and_apologize: "Apologize and give a new ship date",
  offer_refund: "Offer a full refund",
  partial_shipment: "Ship what we have now, rest later",
  cancel_and_refund: "Cancel the order and refund",
  inventory_correction: "Correct the stock count instead",
};

export interface DraftRequest {
  resolution: Resolution;
  /** Which order the message is addressed to. Defaults to the alert's suggestion. */
  orderKey?: string;
}

export interface DemoStatus {
  demoMode: boolean;
  model: string;
  /** Every mutating endpoint is simulated; nothing leaves this machine. */
  simulated: true;
}
