import { useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { Button, Callout, Kv, Pill, SampleTag } from "../components/ui";
import { extractOrderFromEmail } from "../lib/ai";
import { fmtDateTime } from "../lib/format";
import { findOrder, toOrder } from "../lib/orders";
import { SAMPLE_EMAILS } from "../data/seed";
import { useStore } from "../store";
import { CHANNEL_LABELS, type ExtractedOrder, type Order } from "../types";

export function Intake() {
  const { orders, listingMaps, handleImportOrder, pushToast, setView, selectOrder } =
    useStore();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ extracted: ExtractedOrder; order: Order } | null>(
    null,
  );

  /** AI step — extract structured fields. Nothing is committed to state here. */
  async function handleExtract() {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const extracted = await extractOrderFromEmail(email);
      setPreview({ extracted, order: toOrder(extracted, listingMaps) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** The only place an extracted order reaches app state. */
  function handleConfirmImport() {
    if (!preview) return;
    const order = preview.order;
    const outcome = handleImportOrder(order);
    pushToast({
      tone: "info",
      title: outcome === "updated" ? "Existing order updated" : "Order imported",
      body:
        outcome === "updated"
          ? `${order.key} was revised in place — no duplicate was created.`
          : `${order.key} added. Stock commitments recalculated.`,
    });
    setPreview(null);
    setEmail("");
    setView("overview");
    selectOrder(order.key);
  }

  const existing = preview ? findOrder(orders, preview.order.key) : undefined;
  const unresolved = preview?.order.lines.filter((l) => l.matchStatus !== "matched") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Import an order email
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Paste a marketplace notification. Extraction is AI-assisted; duplicate detection,
          deadlines, and stock math are deterministic. Nothing is imported until you
          approve the preview.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Load a sample:</span>
          {SAMPLE_EMAILS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setEmail(s.body);
                setPreview(null);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              {s.label}
            </button>
          ))}
          <SampleTag className="ml-auto" />
        </div>

        <textarea
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          rows={12}
          placeholder="Paste the order notification email here…"
          className="scroll-slim w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50/50 px-3.5 py-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none transition-colors placeholder:font-sans placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={!email.trim() || busy}
            onClick={handleExtract}
          >
            {busy ? "Extracting…" : "Extract order details"}
          </Button>
          {email && (
            <Button
              variant="ghost"
              onClick={() => {
                setEmail("");
                setPreview(null);
                setError(null);
              }}
            >
              Clear
            </Button>
          )}
          {error && <span className="text-sm text-amber-800">{error}</span>}
          <span className="ml-auto text-xs text-zinc-500">
            Step 1 of 2 — extract, then review before importing.
          </span>
        </div>
      </section>

      {preview && (
        <section className="rounded-xl border border-indigo-200 bg-white shadow-xs">
          <header className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Preview — nothing has been imported yet
            </h2>
            {preview.extracted.demoMode ? (
              <Pill tone="amber">demo mode output</Pill>
            ) : (
              <Pill tone="indigo">AI-extracted</Pill>
            )}
          </header>

          <div className="flex flex-col gap-4 p-4">
            {existing ? (
              <Callout tone="amber">
                <strong>This order already exists.</strong> {CHANNEL_LABELS[existing.channel]}{" "}
                {existing.channelOrderId} has been seen {existing.revisions.length} time
                {existing.revisions.length === 1 ? "" : "s"}. Importing will{" "}
                <strong>update it in place</strong>, not create a duplicate — identity is
                channel + order ID.
              </Callout>
            ) : (
              <Callout tone="indigo">
                This is a new order and will be created. Its stock commitment is applied
                once, when it is imported.
              </Callout>
            )}

            <Kv
              items={[
                {
                  k: "Channel",
                  v: <ChannelBadge channel={preview.order.channel} />,
                },
                {
                  k: "Order ID",
                  v: (
                    <span className="font-mono text-xs">{preview.order.channelOrderId}</span>
                  ),
                },
                {
                  k: "Identity key",
                  v: (
                    <span className="font-mono text-xs text-zinc-600">
                      {preview.order.key}
                    </span>
                  ),
                },
                {
                  k: "Customer",
                  v: `${preview.order.customerName} <${preview.order.customerEmail}>`,
                },
                { k: "Placed", v: fmtDateTime(preview.order.placedAt) },
                {
                  k: "Ship by",
                  v: (
                    <span className="flex items-center gap-2">
                      {fmtDateTime(preview.order.shipBy)}
                      {!preview.extracted.shipBy && (
                        <Pill tone="neutral">derived — 2 business days</Pill>
                      )}
                    </span>
                  ),
                },
              ]}
            />

            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Marketplace listing</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Resolved SKU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {preview.order.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-zinc-800">{l.listingTitle}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                        {l.quantity}
                      </td>
                      <td className="px-3 py-2">
                        {l.matchStatus === "matched" ? (
                          <span className="font-mono text-xs text-zinc-700">{l.sku}</span>
                        ) : (
                          <Pill tone="amber">
                            {l.matchStatus === "pending_review"
                              ? "awaiting confirmation"
                              : "no SKU mapping"}
                          </Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {unresolved.length > 0 && (
              <Callout tone="amber">
                {unresolved.length} line{unresolved.length === 1 ? "" : "s"} could not be
                resolved to a SKU with confidence. {unresolved.length === 1 ? "It" : "They"}{" "}
                will be imported but will <strong>hold no stock</strong> until you confirm
                the match in Inventory.
              </Callout>
            )}

            {preview.extracted.notes && (
              <p className="text-xs leading-relaxed text-zinc-500">
                <span className="font-medium text-zinc-600">Note from extraction:</span>{" "}
                {preview.extracted.notes}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              <Button variant="approve" size="lg" onClick={handleConfirmImport}>
                {existing ? "Update existing order" : "Import order"}
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Discard
              </Button>
              <span className="ml-auto text-xs text-zinc-500">
                Step 2 of 2 — this commits the order to local state.
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
