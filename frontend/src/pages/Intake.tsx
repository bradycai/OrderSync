import { useState } from "react";
import {
  CHANNEL_LABELS,
  SAMPLE_EMAILS,
  type ConfirmedOrderInput,
  type ParsePreview,
} from "@orderwatch/shared";
import { api } from "../api";
import { Icon } from "../components/Icon";
import type { View } from "../components/Sidebar";
import { useStore } from "../store";

export function Intake({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { refresh, inventory } = useStore();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  /** Per-line SKU the founder has accepted, keyed by line index. */
  const [accepted, setAccepted] = useState<Record<number, string | null>>({});

  async function parse() {
    setBusy(true);
    setError(null);
    setResult(null);
    setAccepted({});
    setPreview(null);
    try {
      setPreview(await api.parseEmail(email));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const body: ConfirmedOrderInput = {
        channel: preview.extracted.channel,
        channelOrderId: preview.extracted.channelOrderId,
        customerName: preview.extracted.customerName,
        customerEmail: preview.extracted.customerEmail,
        placedAt: preview.extracted.placedAt,
        shipBy: preview.extracted.shipBy,
        status: preview.extracted.status,
        lines: preview.lines.map((l, i) => ({
          listingTitle: l.listingTitle,
          quantity: l.quantity,
          sku: i in accepted ? accepted[i] : l.sku,
        })),
      };
      const out = await api.importOrder(body);
      setResult(out.message);
      setPreview(null);
      setEmail("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const existing = preview?.existing;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">FROM INBOX TO IN CONTROL</p>
        <h1>Import an order email</h1>
        <p className="sub">
          Paste a marketplace notification. Extraction and SKU suggestions are
          AI-assisted; duplicate detection, deadlines, and stock math are
          deterministic and run on the server.
        </p>
      </header>

      <div className="intake-layout">
        <section className="card">
          <label className="form-label" htmlFor="order-email">
            Order notification
          </label>
          <p className="fine">
            Start with a sample, or paste an email from your marketplace.
          </p>
          <div className="samples">
            {SAMPLE_EMAILS.map((s) => (
              <button
                key={s.label}
                disabled={busy}
                className="chip"
                onClick={() => {
                  setEmail(s.body);
                  setPreview(null);
                  setError(null);
                  setResult(null);
                }}
              >
                Load sample: {s.label}
              </button>
            ))}
          </div>

          <textarea
            id="order-email"
            disabled={busy}
            className="paste"
            rows={14}
            placeholder="Paste the order notification email here…"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPreview(null);
              setResult(null);
              setError(null);
            }}
          />

          <div className="actions-row">
            <button
              className="btn btn-primary"
              disabled={!email.trim() || busy}
              onClick={parse}
            >
              {busy ? "Extracting…" : "Extract order details"}
            </button>
            {error && (
              <span className="error" role="alert">
                {error}
              </span>
            )}
            {result && (
              <div className="success" role="status">
                {result}
                <div className="actions-row">
                  <button className="btn" onClick={() => onNavigate("overview")}>
                    View orders <Icon name="arrow" size={16} />
                  </button>
                  <button className="btn" onClick={() => onNavigate("attention")}>
                    Inspect attention queue
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="intake-help">
          <Icon name="spark" />
          <h2>
            One email.
            <br />
            Everything in its place.
          </h2>
          <p>
            Turn a marketplace notification into an order you can actually work
            with.
          </p>
          <ol>
            <li>Load or paste a notification</li>
            <li>Check the extracted details</li>
            <li>Import and review your stock</li>
          </ol>
          <p>
            Repeated notifications update the existing order. Uncertain product
            matches stay pending until you confirm them.
          </p>
          <span className="pill pill-demo">FRONTEND DEMO READY</span>
        </aside>
      </div>

      {preview && (
        <section className="card">
          <h2>
            Preview — nothing has been imported yet
            {preview.demoMode && (
              <span className="pill pill-demo">DEMO MODE OUTPUT</span>
            )}
          </h2>

          {preview.willResult === "update" ? (
            <p className="callout callout-warn">
              A matching order already exists
              {existing && (
                <>
                  {" "}
                  ({CHANNEL_LABELS[existing.channel]} {existing.channelOrderId},
                  imported {existing.revisions.length}×)
                </>
              )}
              . Importing will <strong>update it in place</strong>, not create a
              duplicate.
            </p>
          ) : (
            <p className="callout">This is a new order and will be created.</p>
          )}

          <dl className="kv">
            <dt>Channel</dt>
            <dd>{CHANNEL_LABELS[preview.extracted.channel]}</dd>
            <dt>Order ID</dt>
            <dd className="mono">{preview.extracted.channelOrderId}</dd>
            <dt>Identity key</dt>
            <dd className="mono">{preview.key}</dd>
            <dt>Customer</dt>
            <dd>
              {preview.extracted.customerName} &lt;
              {preview.extracted.customerEmail}&gt;
            </dd>
            <dt>Placed</dt>
            <dd>{new Date(preview.extracted.placedAt).toUTCString()}</dd>
            <dt>Ship by</dt>
            <dd>
              {preview.extracted.shipBy
                ? new Date(preview.extracted.shipBy).toUTCString()
                : "not stated — a deadline will be derived"}
            </dd>
          </dl>

          <table className="table">
            <thead>
              <tr>
                <th>Listing</th>
                <th className="num">Qty</th>
                <th>Resolved SKU</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((l, i) => {
                const chosen = i in accepted ? accepted[i] : l.sku;
                return (
                  <tr key={i}>
                    <td>
                      {l.listingTitle}
                      {l.suggestion?.needsConfirmation && (
                        <div className="fine">
                          Suggested{" "}
                          <span className="mono">
                            {l.suggestion.sku ?? "no match"}
                          </span>{" "}
                          at {Math.round(l.suggestion.confidence * 100)}% —{" "}
                          {l.suggestion.reasoning}
                        </div>
                      )}
                    </td>
                    <td className="num">{l.quantity}</td>
                    <td>
                      <select
                        className="search"
                        aria-label={`SKU for ${l.listingTitle}`}
                        value={chosen ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setAccepted((a) => ({
                            ...a,
                            [i]: e.target.value || null,
                          }))
                        }
                      >
                        <option value="">
                          Pending review — no stock commitment
                        </option>
                        {inventory.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.title} · {p.color} / {p.size} ({p.sku})
                          </option>
                        ))}
                      </select>
                      {!chosen && (
                        <p className="fine">
                          Choose the correct SKU now, or review it later in
                          Inventory.
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {preview.extracted.notes && (
            <p className="fine">
              Note from extraction: {preview.extracted.notes}
            </p>
          )}

          {preview.warnings.length > 0 && (
            <ul className="fine">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="actions-row">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={confirmImport}
            >
              {preview.willResult === "update"
                ? "Update existing order"
                : "Import order"}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>
              Discard
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
