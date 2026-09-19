import { useEffect, useRef, useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { evidenceLine } from "../lib/alerts";
import { useStore } from "../store";
import type { ActionRecord, Alert } from "../types";

export function Attention() {
  const { alerts, orders, actions, setActions } = useStore();
  const [open, setOpen] = useState<Alert | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoDraft, setDemoDraft] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );
  function close() {
    request.current += 1;
    setOpen(null);
  }

  async function review(alert: Alert) {
    const requestId = ++request.current;
    setOpen(alert);
    setBusy(true);
    setDraft("");
    setDemoDraft(false);
    const context =
      `${alert.title}\n${alert.explanation}\n` +
      (alert.calculation
        ? `Inventory: ${evidenceLine(alert.calculation)}\n`
        : "");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error("Draft service unavailable");
      const d = await res.json();
      if (!d.body) throw new Error("No draft returned");
      if (request.current !== requestId) return;
      setDraft(d.body);
      setDemoDraft(Boolean(d.demoMode));
    } catch (e) {
      if (request.current !== requestId) return;
      const action = alert.suggestedAction;
      const customer =
        action.type === "message_customer"
          ? orders.find((o) => o.key === action.orderKey)
          : undefined;
      setDraft(
        `Hi ${customer?.customerName.split(" ")[0] ?? "there"},\n\nI'm reaching out about order ${customer?.channelOrderId ?? "with us"}. ${alert.kind === "insufficient_inventory" ? "We've found a stock shortage affecting an item in your order." : "Your order has not shipped by its expected deadline."} I'm sorry for the delay. We're checking fulfillment options and will follow up with a confirmed shipping update. If you'd prefer to discuss a cancellation or alternative, please let us know.\n\nThank you for your patience,\nStudio Supply`,
      );
      setDemoDraft(true);
    } finally {
      if (request.current === requestId) setBusy(false);
    }
  }

  function approve() {
    if (!open) return;
    const record: ActionRecord = {
      id: `act-${Date.now()}`,
      alertId: open.id,
      action: open.suggestedAction,
      draft,
      status: "approved_simulated",
      decidedAt: new Date().toISOString(),
    };
    setActions([record, ...actions]);
    setOpen(null);
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">LESS GUESSWORK. CLEAR NEXT STEPS.</p>
        <h1>Needs attention</h1>
        <p className="sub">
          Detected by deterministic rules. Messages are AI-drafted and always
          editable.
        </p>
      </header>

      {alerts.length === 0 && (
        <p className="empty">Nothing needs attention right now.</p>
      )}

      {alerts.map((a) => {
        const done = actions.find((x) => x.alertId === a.id);
        return (
          <article key={a.id} className={`card alert alert-${a.severity}`}>
            <div className="alert-head">
              <h2>{a.title}</h2>
              <span className={`pill pill-${a.severity}`}>{a.severity}</span>
            </div>
            <p>{a.explanation}</p>

            {a.calculation && (
              <p className="calc mono">{evidenceLine(a.calculation)}</p>
            )}

            <h3 className="fine">Contributing orders</h3>
            <table className="table compact">
              <tbody>
                {a.relatedOrderKeys.map((k) => {
                  const o = orders.find((x) => x.key === k)!;
                  return (
                    <tr key={k}>
                      <td>
                        <ChannelBadge channel={o.channel} />
                      </td>
                      <td className="mono">{o.channelOrderId}</td>
                      <td>{o.customerName}</td>
                      <td className="num">
                        {o.lines
                          .filter(
                            (l) =>
                              !a.calculation ||
                              (l.sku === a.calculation.sku &&
                                l.matchStatus === "matched"),
                          )
                          .reduce((n, l) => n + l.quantity, 0)}{" "}
                        unit(s)
                      </td>
                      <td className="fine">
                        ship by {new Date(o.shipBy).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="actions-row">
              {done ? (
                <span className="success">
                  Approved — simulated{" "}
                  {new Date(done.decidedAt!).toLocaleTimeString()}
                </span>
              ) : (
                <button className="btn btn-primary" onClick={() => review(a)}>
                  {a.suggestedAction.label}
                </button>
              )}
            </div>
          </article>
        );
      })}

      <dialog
        ref={dialog}
        className="drawer"
        aria-labelledby="review-title"
        onCancel={close}
      >
        {open && (
          <>
            <div className="drawer-head">
              <h2 id="review-title">Review before approving</h2>
              <button className="btn btn-ghost" onClick={close}>
                Close
              </button>
            </div>
            <p className="callout callout-warn">
              <strong>Simulated.</strong> Approving records the outcome in this
              demo. No email is sent and no marketplace is updated.
            </p>
            <p className="fine">{open.title}</p>
            {demoDraft && (
              <p className="pill pill-demo">
                Prepared demo draft · no live AI used
              </p>
            )}
            <label className="form-label" htmlFor="message-draft">
              Customer message · edit before approving
            </label>
            <textarea
              id="message-draft"
              className="paste"
              rows={12}
              value={busy ? "Drafting…" : draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={busy}
            />
            <div className="actions-row">
              <button
                className="btn btn-primary"
                disabled={busy || !draft}
                onClick={approve}
              >
                Approve (simulated send)
              </button>
              <button className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
