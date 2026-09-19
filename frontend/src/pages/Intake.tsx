import { useState } from "react";
import { Icon } from "../components/Icon";
import type { View } from "../components/Sidebar";
import { sampleExtraction } from "../data/demoOutputs";
import { SAMPLE_EMAILS } from "../data/seed";
import { findOrder, toOrder } from "../lib/orders";
import { useStore } from "../store";
import { CHANNEL_LABELS, type ExtractedOrder, type Order } from "../types";

export function Intake({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { orders, listingMaps, importOrder } = useStore();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    extracted: ExtractedOrder;
    order: Order;
  } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function extract() {
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const extracted: ExtractedOrder = await res.json();
      setPreview({ extracted, order: toOrder(extracted, listingMaps) });
    } catch (e) {
      const sample = sampleExtraction(email);
      if (sample)
        setPreview({ extracted: sample, order: toOrder(sample, listingMaps) });
      else
        setError(
          "Extraction is unavailable. Load one of the sample emails to try the frontend demo, or try again when the AI service is running.",
        );
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    if (!preview) return;
    const outcome = importOrder(preview.order);
    setResult(
      outcome === "updated"
        ? `Existing order ${preview.order.key} was updated — no duplicate created.`
        : `Order ${preview.order.key} imported.`,
    );
    setPreview(null);
    setEmail("");
  }

  const existing = preview ? findOrder(orders, preview.order.key) : undefined;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">FROM INBOX TO IN CONTROL</p>
        <h1>Import an order email</h1>
        <p className="sub">
          Paste a marketplace notification. Extraction is AI-assisted; duplicate
          detection and deadlines are deterministic.
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
              onClick={extract}
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
                  <button
                    className="btn"
                    onClick={() => onNavigate("overview")}
                  >
                    View orders <Icon name="arrow" size={16} />
                  </button>
                  <button
                    className="btn"
                    onClick={() => onNavigate("attention")}
                  >
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
            {preview.extracted.demoMode && (
              <span className="pill pill-demo">DEMO MODE OUTPUT</span>
            )}
          </h2>

          {existing ? (
            <p className="callout callout-warn">
              A matching order already exists (
              {CHANNEL_LABELS[existing.channel]} {existing.channelOrderId},
              imported {existing.revisions.length}×). Importing will
              <strong> update it in place</strong>, not create a duplicate.
            </p>
          ) : (
            <p className="callout">This is a new order and will be created.</p>
          )}

          <dl className="kv">
            <dt>Channel</dt>
            <dd>{CHANNEL_LABELS[preview.order.channel]}</dd>
            <dt>Order ID</dt>
            <dd className="mono">{preview.order.channelOrderId}</dd>
            <dt>Identity key</dt>
            <dd className="mono">{preview.order.key}</dd>
            <dt>Customer</dt>
            <dd>
              {preview.order.customerName} &lt;{preview.order.customerEmail}&gt;
            </dd>
            <dt>Placed</dt>
            <dd>{new Date(preview.order.placedAt).toUTCString()}</dd>
            <dt>Ship by</dt>
            <dd>{new Date(preview.order.shipBy).toUTCString()}</dd>
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
              {preview.order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.listingTitle}</td>
                  <td className="num">{l.quantity}</td>
                  <td>
                    {l.sku ?? (
                      <span className="pill pill-warn">needs review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.extracted.notes && (
            <p className="fine">
              Note from extraction: {preview.extracted.notes}
            </p>
          )}

          <div className="actions-row">
            <button className="btn btn-primary" onClick={confirmImport}>
              {existing ? "Update existing order" : "Import order"}
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
