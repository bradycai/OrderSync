import { useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { evidenceLine } from "../lib/alerts";
import { useStore } from "../store";
import type { ActionRecord, Alert } from "../types";

export function Attention() {
  const { alerts, orders, actions, setActions } = useStore();
  const [open, setOpen] = useState<Alert | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(alert: Alert) {
    setOpen(alert);
    setBusy(true);
    setDraft("");
    const context =
      `${alert.title}\n${alert.explanation}\n` +
      (alert.calculation ? `Inventory: ${evidenceLine(alert.calculation)}\n` : "");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const d = await res.json();
      setDraft(d.body ?? d.error ?? "");
    } catch (e) {
      setDraft(`Could not reach the drafting service: ${(e as Error).message}`);
    } finally {
      setBusy(false);
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
        <h1>Needs attention</h1>
        <p className="sub">Detected by deterministic rules. Messages are AI-drafted and always editable.</p>
      </header>

      {alerts.length === 0 && <p className="empty">Nothing needs attention right now.</p>}

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
                      <td><ChannelBadge channel={o.channel} /></td>
                      <td className="mono">{o.channelOrderId}</td>
                      <td>{o.customerName}</td>
                      <td className="num">
                        {o.lines.reduce((n, l) => n + l.quantity, 0)} unit(s)
                      </td>
                      <td className="fine">ship by {new Date(o.shipBy).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="actions-row">
              {done ? (
                <span className="success">Approved — simulated {new Date(done.decidedAt!).toLocaleTimeString()}</span>
              ) : (
                <button className="btn btn-primary" onClick={() => review(a)}>
                  {a.suggestedAction.label}
                </button>
              )}
            </div>
          </article>
        );
      })}

      {open && (
        <div className="drawer">
          <div className="drawer-head">
            <h2>Review before approving</h2>
            <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
          </div>
          <p className="callout callout-warn">
            <strong>Simulated.</strong> Approving records the outcome in this demo. No email is
            sent and no marketplace is updated.
          </p>
          <textarea
            className="paste"
            rows={12}
            value={busy ? "Drafting…" : draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
          <div className="actions-row">
            <button className="btn btn-primary" disabled={busy || !draft} onClick={approve}>
              Approve (simulated send)
            </button>
            <button className="btn btn-ghost" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
