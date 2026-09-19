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
import { upsertOrder } from "./lib/orders";
import type {
  ActionRecord,
  Alert,
  Channel,
  InventorySnapshot,
  ListingMap,
  Order,
  Product,
  TimingRun,
} from "./types";

interface Store {
  products: Product[];
  orders: Order[];
  listingMaps: ListingMap[];
  actions: ActionRecord[];
  timings: TimingRun[];
  channelFilter: Channel | "all";
  search: string;
  now: Date;

  // Derived, recomputed on every change — never cached into state.
  snapshots: InventorySnapshot[];
  alerts: Alert[];
  visibleOrders: Order[];

  setChannelFilter: (c: Channel | "all") => void;
  setSearch: (s: string) => void;
  importOrder: (o: Order) => "created" | "updated";
  setListingMaps: (m: ListingMap[]) => void;
  setActions: (a: ActionRecord[]) => void;
  setTimings: (t: TimingRun[]) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const [listingMaps, setListingMaps] = useState<ListingMap[]>(SEED_LISTING_MAPS);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [timings, setTimings] = useState<TimingRun[]>([]);
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");

  const now = DEMO_NOW;

  const snapshots = useMemo(() => snapshotAll(products, orders), [products, orders]);
  const alerts = useMemo(() => detectAlerts(products, orders, now), [products, orders, now]);

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (channelFilter !== "all" && o.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        o.channelOrderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.lines.some((l) => l.listingTitle.toLowerCase().includes(q))
      );
    });
  }, [orders, channelFilter, search]);

  const importOrder = useCallback((incoming: Order) => {
    let result: "created" | "updated" = "created";
    setOrders((prev) => {
      const out = upsertOrder(prev, incoming);
      result = out.result;
      return out.orders;
    });
    return result;
  }, []);

  const resetDemo = useCallback(() => {
    setProducts(SEED_PRODUCTS);
    setOrders(SEED_ORDERS);
    setListingMaps(SEED_LISTING_MAPS);
    setActions([]);
    setTimings([]);
    setChannelFilter("all");
    setSearch("");
  }, []);

  const value: Store = {
    products, orders, listingMaps, actions, timings, channelFilter, search, now,
    snapshots, alerts, visibleOrders,
    setChannelFilter, setSearch, importOrder, setListingMaps, setActions, setTimings,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
