import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ActionRecord,
  Alert,
  Channel,
  InventoryRow,
  ListingMap,
  Order,
} from "@orderwatch/shared";
import { api } from "./api";

/**
 * The server owns all order, inventory, and action state. This store is a
 * cache of it, and `refresh()` is the single
 * way anything gets re-read after a mutation.
 */
interface Store {
  loading: boolean;
  error: string | null;
  demoMode: boolean;

  orders: Order[];
  inventory: InventoryRow[];
  pendingMatches: ListingMap[];
  alerts: Alert[];
  supportingOrders: Order[];
  actions: ActionRecord[];

  channelFilter: Channel | "all";
  search: string;
  setChannelFilter: (c: Channel | "all") => void;
  setSearch: (s: string) => void;

  refresh: () => Promise<void>;
  resetDemo: () => Promise<void>;
  orderByKey: (key: string) => Order | undefined;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [pendingMatches, setPendingMatches] = useState<ListingMap[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [supportingOrders, setSupportingOrders] = useState<Order[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);

  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [status, o, inv, al, act] = await Promise.all([
        api.status(),
        api.orders({ channel: channelFilter, q: search }),
        api.inventory(),
        api.alerts(),
        api.actions(),
      ]);
      setDemoMode(status.demoMode);
      setOrders(o.orders);
      setInventory(inv.inventory);
      setPendingMatches(inv.pendingMatches);
      setAlerts(al.alerts);
      setSupportingOrders(al.supportingOrders);
      setActions(act.actions);
    } catch (e) {
      setError(
        `${(e as Error).message}. Is the API running? Start it with \`npm run dev:api\`.`,
      );
    } finally {
      setLoading(false);
    }
  }, [channelFilter, search]);

  // Filters are applied server-side, so a filter change is a refetch.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetDemo = useCallback(async () => {
    await api.resetDemo();
    setChannelFilter("all");
    setSearch("");
    await refresh();
  }, [refresh]);

  const byKey = useMemo(() => {
    const m = new Map<string, Order>();
    for (const o of [...orders, ...supportingOrders]) m.set(o.key, o);
    return m;
  }, [orders, supportingOrders]);

  const value: Store = {
    loading, error, demoMode,
    orders, inventory, pendingMatches, alerts, supportingOrders, actions,
    channelFilter, search, setChannelFilter, setSearch,
    refresh, resetDemo,
    orderByKey: (key) => byKey.get(key),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
