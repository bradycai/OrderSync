import { useEffect, useRef, useState } from "react";
import {
  RESOLUTION_LABELS,
  evidenceLine,
  type ActionRecord,
  type Alert,
  type Resolution,
} from "@orderwatch/shared";
import { api } from "../api";
import { ChannelBadge } from "../components/ChannelBadge";
import { useStore } from "../store";

/** Which resolutions make sense for which kind of alert. */
const OPTIONS: Record<Alert["kind"], Resolution[]> = {
  insufficient_inventory: [
    "delay_and_apologize",
    "partial_shipment",
    "offer_refund",
    "inventory_correction",
  ],
  overdue_shipment: ["delay_and_apologize", "offer_refund", "cancel_and_refund"],
};

export function Attention() {
  const { alerts, actions, orderByKey, refresh } = useStore();
  const [open, setOpen] = useState<Alert | null>(null);
  const [resolution, setResolution] = useState<Resolution>("delay_and_apologize");
  const [pending, setPending] = useState<ActionRecord | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoDraft, setDemoDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  function openAlert(alert: Alert) {
    setOpen(alert);
    setResolution(OPTIONS[alert.kind][0]);
    setPending(null);
    setDraft("");
    setDemoDraft(false);
    setError(null);
    setOutcome(null);
  }

  function close() {
    setOpen(null);
  }

  async function generate() {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const out = await api.draft(open.id, resolution);
      setPending(out.action);
      setDraft(out.action.draft);
      setDemoDraft(out.demoMode);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const out = await api.approve(pending.id, draft);
      setOutcome([out.notice, out.inventoryEffect].filter(Boolean).join(" "));
      setPending(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Needs attention</h1>
        <p className="sub">
          Detected by deterministic rules on the server. Messages are AI-drafted,
          always editable, and never sent.
        </p>
      </header>

      {alerts.length === 0 && (
        <p className="empty">Nothing needs attention right now.</p>
      )}

      {alerts.map((a) => {
        const done = actions.find(
          (x) => x.alertId === a.id && x.status === "approved_simulated",
        );
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
                  const o = orderByKey(k);
                  if (!o) return null;
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
                <button className="btn btn-primary" onClick={() => openAlert(a)}>
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

            <label className="form-label" htmlFor="resolution">
              How do you want to resolve this?
            </label>
            <select
              id="resolution"
              className="search wide"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              disabled={busy || !!pending}
            >
              {OPTIONS[open.kind].map((r) => (
                <option key={r} value={r}>
                  {RESOLUTION_LABELS[r]}
                </option>
              ))}
            </select>

            {!pending && !outcome ? (
              <div className="actions-row">
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={generate}
                >
                  {busy
                    ? "Preparing…"
                    : resolution === "inventory_correction"
                      ? "Review stock correction"
                      : "Draft the message"}
                </button>
              </div>
            ) : pending ? (
              <>
                {pending.action.type === "adjust_inventory" ? (
                  <section
                    className="card"
                    aria-label="Proposed inventory correction"
                  >
                    <h3>Verify the physical stock count</h3>
                    <p>
                      This proposes adding stock to the demo. Approve only if the
                      corrected count is accurate.
                    </p>
                    <dl className="kv">
                      <dt>SKU</dt>
                      <dd>{pending.action.sku}</dd>
                      <dt>Current stock</dt>
                      <dd>{pending.action.expectedStartingStock}</dd>
                      <dt>Adjustment</dt>
                      <dd>+{pending.action.delta}</dd>
                      <dt>Proposed stock</dt>
                      <dd>
                        {(pending.action.expectedStartingStock ?? 0) +
                          pending.action.delta}
                      </dd>
                      <dt>Committed</dt>
                      <dd>{pending.action.expectedCommitted}</dd>
                      <dt>Available after</dt>
                      <dd>
                        {(pending.action.expectedStartingStock ?? 0) +
                          pending.action.delta -
                          (pending.action.expectedCommitted ?? 0)}
                      </dd>
                    </dl>
                    <p className="fine">
                      Demo inventory only. No message will be sent or marketplace
                      updated.
                    </p>
                  </section>
                ) : (
                  <>
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
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={busy}
                    />
                  </>
                )}
                <div className="actions-row">
                  <button
                    className="btn btn-primary"
                    disabled={busy || !draft}
                    onClick={approve}
                  >
                    {pending.action.type === "adjust_inventory"
                      ? "Approve demo stock correction"
                      : "Approve (simulated send)"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPending(null)}
                  >
                    {pending.action.type === "adjust_inventory"
                      ? "Review again"
                      : "Re-draft"}
                  </button>
                </div>
              </>
            ) : null}

            {error && <p className="error">{error}</p>}
            {outcome && <p className="success">{outcome}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}
