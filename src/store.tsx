import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEMO_NOW,
  SEED_LISTING_MAPS,
  SEED_ORDERS,
  SEED_PRODUCTS,
} from "./data/seed";
import { detectAlerts } from "./lib/alerts";
import { snapshotAll } from "./lib/inventory";
import { reresolveOrders, upsertOrder } from "./lib/orders";
import { startRun, stopRun } from "./lib/timing";
import type {
  ActionRecord,
  Alert,
  Channel,
  InventorySnapshot,
  ListingMap,
  Order,
  OrderStatus,
  Product,
  SuggestedAction,
  TimingRun,
  Toast,
} from "./types";

export type View = "overview" | "inventory" | "intake" | "attention" | "timing";

/** Seed arrays are module-level constants — never hand them out by reference. */
const clone = <T,>(v: T): T => structuredClone(v);

interface Store {
  view: View;
  products: Product[];
  orders: Order[];
  listingMaps: ListingMap[];
  actions: ActionRecord[];
  timings: TimingRun[];
  activeRun: TimingRun | null;
  toasts: Toast[];
  channelFilter: Channel | "all";
  search: string;
  now: Date;
  selectedOrderKey: string | null;
  selectedAlertId: string | null;

  // Derived, recomputed on every change — never cached into state.
  snapshots: InventorySnapshot[];
  openAlerts: Alert[];
  handledAlerts: Alert[];
  pendingMatches: ListingMap[];
  visibleOrders: Order[];

  setView: (v: View) => void;
  setChannelFilter: (c: Channel | "all") => void;
  setSearch: (s: string) => void;
  selectOrder: (key: string | null) => void;
  selectAlert: (id: string | null) => void;

  handleImportOrder: (parsedOrder: Order) => "created" | "updated";
  handleUpdateOrderStatus: (orderKey: string, status: OrderStatus) => void;
  handleConfirmMatch: (listingMapId: string) => void;
  handleRejectMatch: (listingMapId: string) => void;
  handleAddListingMap: (map: ListingMap) => void;
  handleStartReview: (alert: Alert, action: SuggestedAction, draft: {
    subject: string;
    body: string;
    demoMode: boolean;
  }) => string;
  handleUpdateDraft: (itemId: string, patch: Partial<Pick<ActionRecord, "subject" | "draft" | "proposedDelta">>) => void;
  handleApprove: (itemId: string) => void;
  handleEditSubmit: (itemId: string, newText: string) => void;
  handleDismissAction: (itemId: string) => void;

  handleStartTimer: (mode: TimingRun["mode"], label: string) => void;
  handleStopTimer: () => void;
  handleClearTimings: () => void;

  handleResetDemo: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("overview");
  const [products, setProducts] = useState<Product[]>(() => clone(SEED_PRODUCTS));
  const [orders, setOrders] = useState<Order[]>(() => clone(SEED_ORDERS));
  const [listingMaps, setListingMaps] = useState<ListingMap[]>(() => clone(SEED_LISTING_MAPS));
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [timings, setTimings] = useState<TimingRun[]>([]);
  const [activeRun, setActiveRun] = useState<TimingRun | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  /** Fixed clock keeps the demo reproducible between runs. */
  const now = DEMO_NOW;

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [{ ...t, id }, ...prev].slice(0, 3));
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  /* ---------------------------------------------------------------- *
   * Derived state. Stock math and alert detection are pure functions of
   * (products, orders) — recomputed every render, never stored. That is what
   * makes re-importing a notification unable to double-deduct stock.
   * ---------------------------------------------------------------- */

  const snapshots = useMemo(() => snapshotAll(products, orders), [products, orders]);

  const allAlerts = useMemo(
    () => detectAlerts(products, orders, now),
    [products, orders, now],
  );

  /**
   * An alert leaves the queue once an action against it has been approved.
   * Note this marks it *handled*, not *fixed* — approving a delay message does
   * not conjure stock. An approved inventory correction, by contrast, changes
   * starting stock, so the alert stops being detected at all.
   */
  const handledSignatures = useMemo(
    () =>
      new Set(
        actions
          .filter((a) => a.status === "approved_simulated")
          .map((a) => a.alertSignature),
      ),
    [actions],
  );

  const openAlerts = useMemo(
    () => allAlerts.filter((a) => !handledSignatures.has(a.signature)),
    [allAlerts, handledSignatures],
  );

  const handledAlerts = useMemo(
    () => allAlerts.filter((a) => handledSignatures.has(a.signature)),
    [allAlerts, handledSignatures],
  );

  const pendingMatches = useMemo(
    () => listingMaps.filter((m) => m.status === "pending"),
    [listingMaps],
  );

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (channelFilter !== "all" && o.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        o.channelOrderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.lines.some((l) => l.listingTitle.toLowerCase().includes(q))
      );
    });
  }, [orders, channelFilter, search]);

  /* ---------------------------------------------------------------- *
   * Handlers. One named function per button, so a real API call can replace
   * the body of any of these without touching the components.
   * ---------------------------------------------------------------- */

  const handleImportOrder = useCallback(
    (parsedOrder: Order) => {
      // Computed outside the updater so the created/updated outcome is known
      // synchronously and the updater itself stays pure.
      const out = upsertOrder(orders, parsedOrder);
      setOrders(out.orders);
      return out.result;
    },
    [orders],
  );

  const handleUpdateOrderStatus = useCallback((orderKey: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.key === orderKey ? { ...o, status } : o)));
  }, []);

  /** Applies a new mapping table and re-resolves every order line against it. */
  const applyListingMaps = useCallback((nextMaps: ListingMap[]) => {
    setListingMaps(nextMaps);
    setOrders((prevOrders) => reresolveOrders(prevOrders, nextMaps));
  }, []);

  const handleConfirmMatch = useCallback(
    (listingMapId: string) => {
      // Confirmed matches start counting toward committed stock immediately.
      applyListingMaps(
        listingMaps.map((m) =>
          m.id === listingMapId
            ? { ...m, status: "confirmed" as const, source: "manual" as const }
            : m,
        ),
      );
      pushToast({
        tone: "info",
        title: "Match confirmed",
        body: "Orders using this listing now count toward committed stock.",
      });
    },
    [listingMaps, applyListingMaps, pushToast],
  );

  const handleRejectMatch = useCallback(
    (listingMapId: string) => {
      applyListingMaps(
        listingMaps.map((m) =>
          m.id === listingMapId
            ? { ...m, status: "rejected" as const, source: "manual" as const }
            : m,
        ),
      );
      pushToast({
        tone: "info",
        title: "Match rejected",
        body: "This listing stays unmatched and holds no stock.",
      });
    },
    [listingMaps, applyListingMaps, pushToast],
  );

  /**
   * Records a newly proposed listing → SKU mapping. AI suggestions arrive here
   * as `pending` unless the model was confident enough to skip review.
   */
  const handleAddListingMap = useCallback(
    (map: ListingMap) => {
      applyListingMaps([...listingMaps, map]);
    },
    [listingMaps, applyListingMaps],
  );

  /** Creates the reviewable record. Nothing is applied until it is approved. */
  const handleStartReview = useCallback(
    (
      alert: Alert,
      action: SuggestedAction,
      draft: { subject: string; body: string; demoMode: boolean },
    ) => {
      const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const record: ActionRecord = {
        id,
        alertId: alert.id,
        alertSignature: alert.signature,
        action,
        subject: draft.subject,
        draft: draft.body,
        proposedDelta: action.type === "adjust_inventory" ? action.delta : undefined,
        demoMode: draft.demoMode,
        status: "pending_review",
        createdAt: new Date().toISOString(),
      };
      setActions((prev) => [record, ...prev]);
      return id;
    },
    [],
  );

  const handleUpdateDraft = useCallback(
    (
      itemId: string,
      patch: Partial<Pick<ActionRecord, "subject" | "draft" | "proposedDelta">>,
    ) => {
      setActions((prev) => prev.map((a) => (a.id === itemId ? { ...a, ...patch } : a)));
    },
    [],
  );

  /**
   * The one place an action takes effect. A message approval is recorded only —
   * no email is sent. An inventory approval genuinely edits starting stock,
   * which is what makes the shortage alert stop firing.
   */
  const handleApprove = useCallback(
    (itemId: string) => {
      const record = actions.find((a) => a.id === itemId);
      // Guarding on status keeps a double-click from applying a correction twice.
      if (!record || record.status !== "pending_review") return;

      if (record.action.type === "adjust_inventory") {
        const sku = record.action.sku;
        const delta = record.proposedDelta ?? record.action.delta;
        setProducts((ps) =>
          ps.map((p) =>
            p.sku === sku
              ? { ...p, startingStock: Math.max(0, p.startingStock + delta) }
              : p,
          ),
        );
        pushToast({
          tone: "simulated",
          title: "Stock correction applied locally",
          body: `${sku} starting stock ${delta >= 0 ? "+" : ""}${delta}. No marketplace was updated.`,
        });
      } else {
        pushToast({
          tone: "simulated",
          title: "Message marked as sent",
          body: `Draft for ${record.action.orderKey} recorded. No email left this machine.`,
        });
      }

      setActions((prev) =>
        prev.map((a) =>
          a.id === itemId
            ? {
                ...a,
                status: "approved_simulated" as const,
                decidedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      setSelectedAlertId(null);
    },
    [actions, pushToast],
  );

  /** The draft's own Send button: save the edited text, then approve it. */
  const handleEditSubmit = useCallback(
    (itemId: string, newText: string) => {
      handleUpdateDraft(itemId, { draft: newText });
      handleApprove(itemId);
    },
    [handleUpdateDraft, handleApprove],
  );

  const handleDismissAction = useCallback((itemId: string) => {
    setActions((prev) => prev.filter((a) => a.id !== itemId));
  }, []);

  /* ------------------------------ timer ------------------------------ */

  const handleStartTimer = useCallback((mode: TimingRun["mode"], label: string) => {
    setActiveRun(startRun(mode, label));
  }, []);

  const handleStopTimer = useCallback(() => {
    if (!activeRun) return;
    setTimings((prev) => [stopRun(activeRun), ...prev]);
    setActiveRun(null);
  }, [activeRun]);

  const handleClearTimings = useCallback(() => {
    setTimings([]);
    setActiveRun(null);
  }, []);

  /* ------------------------------ reset ------------------------------ */

  const handleResetDemo = useCallback(() => {
    setProducts(clone(SEED_PRODUCTS));
    setOrders(clone(SEED_ORDERS));
    setListingMaps(clone(SEED_LISTING_MAPS));
    setActions([]);
    setTimings([]);
    setActiveRun(null);
    setChannelFilter("all");
    setSearch("");
    setSelectedOrderKey(null);
    setSelectedAlertId(null);
    setView("overview");
    pushToast({
      tone: "info",
      title: "Demo reset",
      body: "Stock, orders, alerts, and timings are back to their seeded state.",
    });
  }, [pushToast]);

  const value: Store = {
    view,
    products,
    orders,
    listingMaps,
    actions,
    timings,
    activeRun,
    toasts,
    channelFilter,
    search,
    now,
    selectedOrderKey,
    selectedAlertId,
    snapshots,
    openAlerts,
    handledAlerts,
    pendingMatches,
    visibleOrders,
    setView,
    setChannelFilter,
    setSearch,
    selectOrder: setSelectedOrderKey,
    selectAlert: setSelectedAlertId,
    handleImportOrder,
    handleUpdateOrderStatus,
    handleConfirmMatch,
    handleRejectMatch,
    handleAddListingMap,
    handleStartReview,
    handleUpdateDraft,
    handleApprove,
    handleEditSubmit,
    handleDismissAction,
    handleStartTimer,
    handleStopTimer,
    handleClearTimings,
    handleResetDemo,
    pushToast,
    dismissToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
