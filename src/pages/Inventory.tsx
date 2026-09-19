import { Fragment, useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { Button, Callout, EmptyState, Pill, SampleTag } from "../components/ui";
import { suggestMatch } from "../lib/ai";
import { isLow } from "../lib/inventory";
import { useStore } from "../store";
import { CHANNEL_LABELS, type Channel, type ListingMap } from "../types";

/** Confidence at or above this is treated as certain enough to skip review. */
const AUTO_CONFIRM_AT = 0.9;

export function Inventory() {
  const {
    products,
    orders,
    snapshots,
    listingMaps,
    pendingMatches,
    handleConfirmMatch,
    handleRejectMatch,
    handleAddListingMap,
    selectOrder,
    setView,
    pushToast,
  } = useStore();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyTitle, setBusyTitle] = useState<string | null>(null);

  /** Listing titles seen on real orders that resolve to no SKU at all. */
  const unmatched = (() => {
    const seen = new Map<string, { channel: Channel; listingTitle: string; orderKeys: string[] }>();
    for (const o of orders) {
      for (const l of o.lines) {
        if (l.matchStatus !== "unmatched") continue;
        const k = `${o.channel}::${l.listingTitle}`;
        const hit = seen.get(k);
        if (hit) hit.orderKeys.push(o.key);
        else seen.set(k, { channel: o.channel, listingTitle: l.listingTitle, orderKeys: [o.key] });
      }
    }
    return [...seen.values()];
  })();

  /** AI step — propose a SKU, then route it to review unless it is certain. */
  async function handleSuggestMatch(channel: Channel, listingTitle: string) {
    setBusyTitle(listingTitle);
    try {
      const s = await suggestMatch(listingTitle, products);
      if (!s.sku) {
        pushToast({
          tone: "info",
          title: "No confident match found",
          body: s.reasoning,
        });
        return;
      }
      const certain = s.confidence >= AUTO_CONFIRM_AT;
      const map: ListingMap = {
        id: `lm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channel,
        listingTitle,
        sku: s.sku,
        confidence: s.confidence,
        status: certain ? "confirmed" : "pending",
        source: "ai",
        reasoning: s.reasoning,
      };
      handleAddListingMap(map);
      pushToast({
        tone: "info",
        title: certain
          ? `Matched to ${s.sku}`
          : `Suggested ${s.sku} — needs your confirmation`,
        body: certain
          ? `Confidence ${Math.round(s.confidence * 100)}%. It now counts toward committed stock.`
          : `Confidence ${Math.round(s.confidence * 100)}%. It holds no stock until you confirm it.`,
      });
    } finally {
      setBusyTitle(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-zinc-900">
          Inventory
          <SampleTag />
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Starting stock is never edited by an import. Committed units are recomputed from
          live orders on every change, so the same notification arriving twice cannot
          double-count a deduction.
        </p>
      </header>

      {pendingMatches.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-amber-900">
              {pendingMatches.length} uncertain product match
              {pendingMatches.length === 1 ? "" : "es"} awaiting confirmation
            </h2>
            <Pill tone="amber">excluded from stock math</Pill>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
            These listings look like one of your products, but not certainly enough to act
            on. They hold no stock until you confirm them.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {pendingMatches.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ChannelBadge channel={m.channel} />
                    <span className="text-sm text-zinc-800">“{m.listingTitle}”</span>
                    <span className="text-zinc-400">→</span>
                    <span className="font-mono text-xs text-zinc-700">{m.sku}</span>
                    <Pill tone="amber">{Math.round(m.confidence * 100)}% confidence</Pill>
                    {m.source === "ai" && <Pill tone="indigo">AI suggestion</Pill>}
                  </div>
                  {m.reasoning && (
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                      {m.reasoning}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleConfirmMatch(m.id)}>
                    Confirm match
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRejectMatch(m.id)}>
                    Not our product
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {unmatched.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            {unmatched.length} listing{unmatched.length === 1 ? "" : "s"} with no SKU mapping
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            These arrived on an order under a name your catalog does not use. Ask for a
            suggestion, then confirm it yourself.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {unmatched.map((u) => (
              <div
                key={`${u.channel}-${u.listingTitle}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
              >
                <ChannelBadge channel={u.channel} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">
                  “{u.listingTitle}”
                </span>
                <span className="text-xs text-zinc-500">
                  on {u.orderKeys.length} order{u.orderKeys.length === 1 ? "" : "s"}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyTitle === u.listingTitle}
                  onClick={() => handleSuggestMatch(u.channel, u.listingTitle)}
                >
                  {busyTitle === u.listingTitle ? "Thinking…" : "Suggest a SKU"}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {snapshots.length === 0 ? (
        <EmptyState title="No products in the catalog" />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">SKU</th>
                  <th className="px-4 py-2.5 text-left font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Starting stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Committed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Available</th>
                  <th className="px-4 py-2.5 text-left font-medium">Mapped listings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {snapshots.map((s) => {
                  const p = products.find((x) => x.sku === s.sku)!;
                  const maps = listingMaps.filter(
                    (m) => m.sku === s.sku && m.status === "confirmed",
                  );
                  const short = s.available < 0;
                  const isOpen = expanded === s.sku;

                  return (
                    <Fragment key={s.sku}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : s.sku)}
                        className={`cursor-pointer transition-colors ${
                          short ? "bg-amber-50/70 hover:bg-amber-100/60" : "hover:bg-zinc-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-zinc-700">{s.sku}</td>
                        <td className="px-4 py-3 text-zinc-800">
                          {p.title} — {p.color} / {p.size}
                          {short && (
                            <Pill tone="amber" className="ml-2">
                              oversold
                            </Pill>
                          )}
                          {!short && isLow(s) && (
                            <Pill tone="amber" className="ml-2">
                              running low
                            </Pill>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                          {s.startingStock}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                          {s.committed}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${
                            short ? "text-amber-800" : "text-zinc-900"
                          }`}
                        >
                          {s.available}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {maps.length > 0
                            ? maps.map((m) => CHANNEL_LABELS[m.channel]).join(", ")
                            : "—"}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-zinc-50/60">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-col gap-2.5">
                              <Callout tone="neutral">
                                <span className="font-mono text-xs">
                                  {s.startingStock} in stock − {s.committed} committed ={" "}
                                  <strong>{s.available} available</strong>
                                </span>
                              </Callout>

                              {s.contributingOrderKeys.length === 0 ? (
                                <p className="text-xs text-zinc-500">
                                  No open orders are holding this SKU.
                                </p>
                              ) : (
                                <div>
                                  <p className="mb-1.5 text-xs font-medium text-zinc-600">
                                    Orders holding this stock
                                  </p>
                                  <div className="flex flex-col gap-1.5">
                                    {s.contributingOrderKeys.map((k) => {
                                      const o = orders.find((x) => x.key === k)!;
                                      const qty = o.lines
                                        .filter((l) => l.sku === s.sku)
                                        .reduce((n, l) => n + l.quantity, 0);
                                      return (
                                        <button
                                          key={k}
                                          type="button"
                                          onClick={() => {
                                            setView("overview");
                                            selectOrder(k);
                                          }}
                                          className="flex items-center gap-2.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                                        >
                                          <ChannelBadge channel={o.channel} />
                                          <span className="font-mono text-zinc-700">
                                            {o.channelOrderId}
                                          </span>
                                          <span className="text-zinc-600">
                                            {o.customerName}
                                          </span>
                                          <span className="ml-auto tabular-nums text-zinc-700">
                                            {qty} unit{qty === 1 ? "" : "s"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
