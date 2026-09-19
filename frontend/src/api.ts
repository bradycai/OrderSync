import type {
  ActionRecord,
  Alert,
  AlertsResponse,
  Channel,
  ConfirmedOrderInput,
  DemoStatus,
  InventoryRow,
  ListingMap,
  Order,
  OrderStatus,
  ParsePreview,
  Resolution,
} from "@orderwatch/shared";

/** Thin typed wrapper over the API. All state lives on the server. */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  status: () => request<DemoStatus>("/status"),

  orders: (filters: { channel?: Channel | "all"; status?: OrderStatus; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (filters.channel && filters.channel !== "all") p.set("channel", filters.channel);
    if (filters.status) p.set("status", filters.status);
    if (filters.q?.trim()) p.set("q", filters.q.trim());
    const qs = p.toString();
    return request<{ orders: Order[]; total: number; filtered: number }>(
      `/orders${qs ? `?${qs}` : ""}`,
    );
  },

  parseEmail: (email: string) => post<ParsePreview>("/orders/parse-email", { email }),

  importOrder: (order: ConfirmedOrderInput) =>
    post<{ order: Order; result: "created" | "updated"; message: string }>("/orders", order),

  inventory: () =>
    request<{
      inventory: InventoryRow[];
      shortages: number;
      lowStock: number;
      pendingMatches: ListingMap[];
      calculatedAt: string;
    }>("/inventory"),

  alerts: () => request<AlertsResponse>("/alerts"),

  draft: (alertId: string, resolution: Resolution, orderKey?: string) =>
    post<{
      action: ActionRecord;
      subject: string;
      order: Order;
      resolution: Resolution;
      demoMode: boolean;
      simulated: true;
      notice: string;
    }>(`/alerts/${encodeURIComponent(alertId)}/draft`, { resolution, orderKey }),

  approve: (actionId: string, draft: string) =>
    post<{
      action: ActionRecord;
      simulated: true;
      inventoryEffect: string | null;
      notice: string;
    }>(`/actions/${encodeURIComponent(actionId)}/approve`, { draft }),

  actions: () => request<{ actions: ActionRecord[] }>("/actions"),

  resetDemo: () => post<{ ok: boolean; message: string }>("/demo/reset"),
};

export type { Alert, InventoryRow, Order, ParsePreview };
