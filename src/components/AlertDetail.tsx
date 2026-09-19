import { useEffect, useRef, useState } from "react";
import { ChannelBadge } from "./ChannelBadge";
import { Drawer } from "./Drawer";
import { StatusPill } from "./StatusPill";
import { Button, Callout, Pill, SimulatedTag } from "./ui";
import { draftMessage } from "../lib/ai";
import { evidenceLine } from "../lib/alerts";
import { fmtDateTime } from "../lib/format";
import { useStore } from "../store";
import { CHANNEL_LABELS, type Alert, type SuggestedAction } from "../types";

/**
 * Review and approve. Everything above the fold explains *why* the alert
 * exists — the deterministic arithmetic and the orders behind it — and the
 * approve control is the single most prominent thing on the screen.
 */
export function AlertDetail() {
  const {
    openAlerts,
    handledAlerts,
    orders,
    actions,
    selectedAlertId,
    selectAlert,
    selectOrder,
    setView,
    handleStartReview,
    handleUpdateDraft,
    handleApprove,
    handleEditSubmit,
    handleDismissAction,
  } = useStore();

  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const preparedFor = useRef<string | null>(null);

  const alert =
    openAlerts.find((a) => a.id === selectedAlertId) ??
    handledAlerts.find((a) => a.id === selectedAlertId) ??
    null;

  // Matched on signature, not id: an alert whose numbers have since moved is a
  // genuinely new problem and must not look already-handled.
  const settled = alert
    ? actions.find(
        (a) => a.alertSignature === alert.signature && a.status === "approved_simulated",
      )
    : undefined;

  /** Builds the context handed to the drafting model. */
  function buildContext(a: Alert): string {
    const related = a.relatedOrderKeys
      .map((k) => orders.find((o) => o.key === k))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    const target = related[related.length - 1];
    return [
      a.title,
      a.explanation,
      a.calculation ? `Inventory math: ${evidenceLine(a.calculation)}` : "",
      target
        ? `Write to: ${target.customerName} about ${CHANNEL_LABELS[target.channel]} order ${target.channelOrderId}.`
        : "",
      target ? `Items: ${target.lines.map((l) => `${l.quantity}x ${l.listingTitle}`).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function prepareAction(a: Alert, action: SuggestedAction, replaceId: string | null) {
    if (replaceId) handleDismissAction(replaceId);

    if (action.type === "adjust_inventory") {
      // Deterministic proposal — no model involved in a stock correction.
      const id = handleStartReview(a, action, {
        subject: `Stock correction — ${action.sku}`,
        body: "",
        demoMode: false,
      });
      setRecordId(id);
      return;
    }

    setLoading(true);
    setRecordId(null);
    try {
      const d = await draftMessage(buildContext(a));
      const id = handleStartReview(a, action, {
        subject: d.subject,
        body: d.body,
        demoMode: Boolean(d.demoMode),
      });
      setRecordId(id);
    } finally {
      setLoading(false);
    }
  }

  // Prepare the recommended action as soon as the alert opens, so the founder
  // lands on a ready-to-edit draft rather than an empty screen.
  useEffect(() => {
    if (!alert || settled) {
      preparedFor.current = null;
      setRecordId(null);
      return;
    }
    if (preparedFor.current === alert.id) return;
    preparedFor.current = alert.id;
    void prepareAction(alert, alert.suggestedActions[0], null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id, Boolean(settled)]);

  if (!alert) return null;

  const record = actions.find((a) => a.id === recordId) ?? null;
  const related = alert.relatedOrderKeys
    .map((k) => orders.find((o) => o.key === k))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  const isInventory = record?.action.type === "adjust_inventory";
  const canApprove =
    !!record &&
    !loading &&
    (isInventory ? (record.proposedDelta ?? 0) !== 0 : record.draft.trim().length > 0);

  return (
    <Drawer
      open
      width="max-w-2xl"
      onClose={() => selectAlert(null)}
      title={alert.title}
      subtitle={
        <span className="flex items-center gap-2">
          <Pill tone="amber">
            {alert.kind === "insufficient_inventory" ? "Inventory shortage" : "Overdue shipment"}
          </Pill>
          <span className="text-xs text-zinc-500">Detected by deterministic rules</span>
        </span>
      }
      footer={
        settled ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Pill tone="emerald">Approved</Pill>
            <SimulatedTag />
            <span>Recorded {settled.decidedAt ? fmtDateTime(settled.decidedAt) : ""}.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="approve"
              size="lg"
              disabled={!canApprove}
              onClick={() => record && handleApprove(record.id)}
            >
              {isInventory ? "Approve stock correction" : "Approve and send"}
              <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                simulated
              </span>
            </Button>
            <Button variant="ghost" onClick={() => selectAlert(null)}>
              Cancel
            </Button>
            <span className="ml-auto text-xs text-zinc-500">
              Approving records the outcome here only.
            </span>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-zinc-700">{alert.explanation}</p>

        {alert.calculation && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              How this was calculated
            </h3>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-sm text-zinc-800">
                <span>{alert.calculation.startingStock} in stock</span>
                <span className="text-zinc-400">−</span>
                <span>{alert.calculation.committed} committed</span>
                <span className="text-zinc-400">=</span>
                <span className="font-semibold text-amber-800">
                  {alert.calculation.available} available
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Starting stock is physical units on hand and is never edited by an import.
                Committed units are recomputed from live orders on every change, so a
                repeated notification cannot double-count. Canceled orders and unconfirmed
                matches are excluded.
              </p>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Contributing orders ({related.length})
          </h3>
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {related.map((o) => (
                  <tr
                    key={o.key}
                    onClick={() => {
                      selectAlert(null);
                      setView("overview");
                      selectOrder(o.key);
                    }}
                    className="cursor-pointer transition-colors hover:bg-zinc-50"
                  >
                    <td className="px-3 py-2.5">
                      <ChannelBadge channel={o.channel} />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-700">
                      {o.channelOrderId}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-800">{o.customerName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-zinc-800">
                      {o.lines.reduce((n, l) => n + l.quantity, 0)} units
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-500">
                      ship by {fmtDateTime(o.shipBy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {settled ? (
          <Callout tone="indigo">
            <div className="flex items-center gap-2">
              <strong>This alert has been handled.</strong>
              <SimulatedTag />
            </div>
            <p className="mt-1.5 text-sm">
              {settled.action.type === "adjust_inventory"
                ? `Starting stock for ${settled.action.sku} was corrected by ${settled.proposedDelta ?? settled.action.delta} in this prototype.`
                : "The message below was approved and recorded. No email was sent."}
            </p>
            {settled.draft && (
              <pre className="mt-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 font-sans text-xs leading-relaxed text-zinc-700">
                {settled.draft}
              </pre>
            )}
          </Callout>
        ) : (
          <>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Choose an action
              </h3>
              <div className="flex flex-col gap-2">
                {alert.suggestedActions.map((action, i) => {
                  const active = record?.action.type === action.type;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => prepareAction(alert, action, record?.id ?? null)}
                      className={`rounded-lg border px-3.5 py-3 text-left transition-colors ${
                        active
                          ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">
                          {action.label}
                        </span>
                        {i === 0 && <Pill tone="indigo">recommended</Pill>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                        {action.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {isInventory ? "Proposed correction" : "Draft message"}
                </h3>
                {record?.demoMode && <Pill tone="amber">demo mode output</Pill>}
                {!isInventory && !record?.demoMode && record && (
                  <Pill tone="indigo">AI-drafted</Pill>
                )}
              </div>

              {loading && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                  Drafting…
                </div>
              )}

              {!loading && record && isInventory && (
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <label
                    htmlFor="delta"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Adjust starting stock by
                  </label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      id="delta"
                      type="number"
                      value={record.proposedDelta ?? 0}
                      onChange={(e) =>
                        handleUpdateDraft(record.id, {
                          proposedDelta: Number(e.target.value),
                        })
                      }
                      className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums shadow-xs focus:border-indigo-400"
                    />
                    <span className="text-sm text-zinc-600">
                      units of{" "}
                      <span className="font-mono text-xs">
                        {record.action.type === "adjust_inventory" ? record.action.sku : ""}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                    This edits the prototype's starting-stock figure, which re-runs the
                    shortage calculation. No marketplace listing is updated.
                  </p>
                </div>
              )}

              {!loading && record && !isInventory && (
                <div className="rounded-lg border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-100 px-3 py-2">
                    <input
                      value={record.subject}
                      onChange={(e) =>
                        handleUpdateDraft(record.id, { subject: e.target.value })
                      }
                      placeholder="Subject"
                      className="w-full text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  </div>
                  <textarea
                    value={record.draft}
                    onChange={(e) => handleUpdateDraft(record.id, { draft: e.target.value })}
                    rows={10}
                    className="scroll-slim w-full resize-y px-3 py-2.5 text-sm leading-relaxed text-zinc-800 outline-none"
                  />
                  <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!canApprove}
                      onClick={() => handleEditSubmit(record.id, record.draft)}
                    >
                      Send this draft
                    </Button>
                    <SimulatedTag />
                    <span className="text-xs text-zinc-500">
                      Edit freely — the text you approve is what gets recorded.
                    </span>
                  </div>
                </div>
              )}
            </section>

            <Callout tone="amber">
              <strong>Nothing here contacts the outside world.</strong> Approving records
              the decision in this prototype. No email is delivered and no marketplace
              inventory is changed.
            </Callout>
          </>
        )}
      </div>
    </Drawer>
  );
}
