import { AlertDetail } from "../components/AlertDetail";
import { ChannelBadge } from "../components/ChannelBadge";
import { EmptyState, Pill, SimulatedTag } from "../components/ui";
import { evidenceLine } from "../lib/alerts";
import { fmtDateTime } from "../lib/format";
import { useStore } from "../store";
import type { Alert } from "../types";

export function Attention() {
  const { openAlerts, handledAlerts, orders, actions, selectAlert } = useStore();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Needs attention
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Detected by deterministic rules — stock arithmetic and deadlines, never a model.
          The model only drafts the message once an alert exists. Click an alert to review
          and approve a response.
        </p>
      </header>

      {openAlerts.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          body="No shortages and no overdue shipments. Import an order or reset the demo to see the queue populate."
        />
      ) : (
        <section className="flex flex-col gap-2.5">
          {openAlerts.map((a) => (
            <AlertRow key={a.id} alert={a} onOpen={() => selectAlert(a.id)} orders={orders} />
          ))}
        </section>
      )}

      {handledAlerts.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Handled in this session ({handledAlerts.length})
          </h2>
          <div className="flex flex-col gap-2">
            {handledAlerts.map((a) => {
              const record = actions.find(
                (x) => x.alertSignature === a.signature && x.status === "approved_simulated",
              );
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectAlert(a.id)}
                  className="flex flex-wrap items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <Pill tone="emerald">Approved</Pill>
                  <SimulatedTag />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-600">
                    {a.title}
                  </span>
                  {record?.decidedAt && (
                    <span className="text-xs text-zinc-400">
                      {fmtDateTime(record.decidedAt)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Approving a message marks an alert handled — it does not conjure stock. An
            approved stock correction changes starting stock, so that alert stops being
            detected altogether.
          </p>
        </section>
      )}

      <AlertDetail />
    </div>
  );
}

function AlertRow({
  alert,
  onOpen,
  orders,
}: {
  alert: Alert;
  onOpen: () => void;
  orders: ReturnType<typeof useStore>["orders"];
}) {
  const related = alert.relatedOrderKeys
    .map((k) => orders.find((o) => o.key === k))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/80"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d={
                alert.kind === "insufficient_inventory"
                  ? "M2.5 5.5 8 2.5l5.5 3v5L8 13.5l-5.5-3v-5Z"
                  : "M8 4.5V8l2.2 1.3M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
              }
            />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">{alert.title}</h3>
            <Pill tone="amber">
              {alert.kind === "insufficient_inventory" ? "shortage" : "overdue"}
            </Pill>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-zinc-700">{alert.explanation}</p>

          {alert.calculation && (
            <p className="mt-2 inline-block rounded-md bg-white/80 px-2 py-1 font-mono text-xs text-zinc-700 ring-1 ring-inset ring-amber-200">
              {evidenceLine(alert.calculation)}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              {related.length} contributing order{related.length === 1 ? "" : "s"}:
            </span>
            {related.map((o) => (
              <span key={o.key} className="inline-flex items-center gap-1.5">
                <ChannelBadge channel={o.channel} compact />
                <span className="font-mono text-xs text-zinc-600">{o.channelOrderId}</span>
              </span>
            ))}
          </div>
        </div>

        <span className="ml-auto shrink-0 self-center rounded-lg bg-white px-3 py-2 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors group-hover:bg-zinc-900 group-hover:text-white group-hover:ring-zinc-900">
          {alert.suggestedActions[0].label} →
        </span>
      </div>
    </button>
  );
}
