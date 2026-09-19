import { useState } from "react";
import { SAMPLE_EMAILS } from "../data/seed";
import { findOrder, toOrder } from "../lib/orders";
import { useStore } from "../store";
import { CHANNEL_LABELS, type ExtractedOrder, type Order } from "../types";

export function Intake() {
  const { orders, listingMaps, importOrder } = useStore();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ extracted: ExtractedOrder; order: Order } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function extract() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const extracted: ExtractedOrder = await res.json();
      setPreview({ extracted, order: toOrder(extracted, listingMaps) });
    } catch (e) {
      setError((e as Error).message);
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
        <h1>Import an order email</h1>
        <p className="sub">
          Paste a marketplace notification. Extraction is AI-assisted; duplicate detection
          and deadlines are deterministic.
        </p>
      </header>

      <div className="samples">
        {SAMPLE_EMAILS.map((s) => (
          <button key={s.label} className="chip" onClick={() => setEmail(s.body)}>
            Load sample: {s.label}
          </button>
        ))}
      </div>

      <textarea
        className="paste"
        rows={14}
        placeholder="Paste the order notification email here…"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div className="actions-row">
        <button className="btn btn-primary" disabled={!email.trim() || busy} onClick={extract}>
          {busy ? "Extracting…" : "Extract order details"}
        </button>
        {error && <span className="error">{error}</span>}
        {result && <span className="success">{result}</span>}
      </div>

      {preview && (
        <section className="card">
          <h2>
            Preview — nothing has been imported yet
            {preview.extracted.demoMode && <span className="pill pill-demo">DEMO MODE OUTPUT</span>}
          </h2>

          {existing ? (
            <p className="callout callout-warn">
              A matching order already exists ({CHANNEL_LABELS[existing.channel]}{" "}
              {existing.channelOrderId}, imported {existing.revisions.length}×). Importing will
              <strong> update it in place</strong>, not create a duplicate.
            </p>
          ) : (
            <p className="callout">This is a new order and will be created.</p>
          )}

          <dl className="kv">
            <dt>Channel</dt><dd>{CHANNEL_LABELS[preview.order.channel]}</dd>
            <dt>Order ID</dt><dd className="mono">{preview.order.channelOrderId}</dd>
            <dt>Identity key</dt><dd className="mono">{preview.order.key}</dd>
            <dt>Customer</dt><dd>{preview.order.customerName} &lt;{preview.order.customerEmail}&gt;</dd>
            <dt>Placed</dt><dd>{new Date(preview.order.placedAt).toUTCString()}</dd>
            <dt>Ship by</dt><dd>{new Date(preview.order.shipBy).toUTCString()}</dd>
          </dl>

          <table className="table">
            <thead>
              <tr><th>Listing</th><th className="num">Qty</th><th>Resolved SKU</th></tr>
            </thead>
            <tbody>
              {preview.order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.listingTitle}</td>
                  <td className="num">{l.quantity}</td>
                  <td>
                    {l.sku ?? <span className="pill pill-warn">needs review</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {preview.extracted.notes && <p className="fine">Note from extraction: {preview.extracted.notes}</p>}

          <div className="actions-row">
            <button className="btn btn-primary" onClick={confirmImport}>
              {existing ? "Update existing order" : "Import order"}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>Discard</button>
          </div>
        </section>
      )}
    </div>
  );
}
