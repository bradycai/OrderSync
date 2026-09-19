import { ChannelBadge } from "../components/ChannelBadge";
import { OrderDetail } from "../components/OrderDetail";
import { StatTile } from "../components/StatTile";
import { StatusPill } from "../components/StatusPill";
import { EmptyState, Pill, SampleTag } from "../components/ui";
import { isLow } from "../lib/inventory";
import { deadlineLabel, fmtDate } from "../lib/format";
import { useStore } from "../store";
import { CHANNELS, CHANNEL_LABELS } from "../types";

export function Overview() {
  const {
    orders,
    snapshots,
    openAlerts,
    visibleOrders,
    channelFilter,
    setChannelFilter,
    search,
    setSearch,
    now,
    selectOrder,
    setView,
  } = useStore();

  const awaiting = orders.filter((o) => o.status === "awaiting_shipment").length;
  const low = snapshots.filter(isLow).length;
  const shortages = snapshots.filter((s) => s.available < 0).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-zinc-900">
            Overview
            <SampleTag />
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Every channel in one place. Click any order to open it.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total orders" value={orders.length} note="Across four channels" />
        <StatTile
          label="Awaiting shipment"
          value={awaiting}
          tone={awaiting > 0 ? "warn" : "neutral"}
          note="These are the orders holding stock"
        />
        <StatTile
          label="Products running low"
          value={low}
          tone={low > 0 ? "warn" : "neutral"}
          note={`${shortages} already oversold`}
          onClick={() => setView("inventory")}
          actionLabel="Open inventory"
        />
        <StatTile
          label="Needs attention"
          value={openAlerts.length}
          tone={openAlerts.length > 0 ? "warn" : "neutral"}
          note={
            openAlerts.length > 0
              ? "Shortages and overdue shipments"
              : "Everything is handled"
          }
          onClick={() => setView("attention")}
          actionLabel="Review queue"
        />
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={channelFilter === "all"}
            onClick={() => setChannelFilter("all")}
            label="All channels"
            count={orders.length}
          />
          {CHANNELS.map((c) => (
            <FilterChip
              key={c}
              active={channelFilter === c}
              onClick={() => setChannelFilter(c)}
              label={CHANNEL_LABELS[c]}
              count={orders.filter((o) => o.channel === c).length}
            />
          ))}
        </div>

        <div className="relative ml-auto w-full max-w-xs">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M11 11l3 3M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID, customer, or product…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-8 text-sm shadow-xs transition-colors placeholder:text-zinc-400 focus:border-indigo-400"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {visibleOrders.length === 0 ? (
        <EmptyState
          title="No orders match that filter"
          body="Try a different channel, or clear the search box."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Order</th>
                  <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-left font-medium">Channel</th>
                  <th className="px-4 py-2.5 text-left font-medium">Placed</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ship by</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibleOrders.map((o) => {
                  const deadline = deadlineLabel(o.shipBy, now);
                  const late = o.status === "awaiting_shipment" && deadline.late;
                  const units = o.lines.reduce((n, l) => n + l.quantity, 0);
                  const firstLine = o.lines[0];
                  const extra = o.lines.length - 1;

                  return (
                    <tr
                      key={o.key}
                      tabIndex={0}
                      onClick={() => selectOrder(o.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectOrder(o.key);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                        {o.channelOrderId}
                        {o.source === "email_import" && (
                          <Pill tone="indigo" className="ml-2">
                            imported
                          </Pill>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-800">{o.customerName}</td>
                      <td className="max-w-[260px] px-4 py-3 text-zinc-800">
                        <span className="block truncate">{firstLine?.listingTitle}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {extra > 0 && (
                            <span className="text-xs text-zinc-500">+{extra} more</span>
                          )}
                          {o.lines.some((l) => l.matchStatus !== "matched") && (
                            <Pill tone="amber">match pending</Pill>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-800">
                        {units}
                      </td>
                      <td className="px-4 py-3">
                        <ChannelBadge channel={o.channel} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {fmtDate(o.placedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={late ? "font-medium text-amber-800" : "text-zinc-600"}>
                          {fmtDate(o.shipBy)}
                        </span>
                        {late && (
                          <span className="ml-1.5 text-xs text-amber-700">
                            {deadline.text}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <OrderDetail />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
      }`}
    >
      {label}
      <span className={active ? "text-zinc-300" : "text-zinc-400"}>{count}</span>
    </button>
  );
}
