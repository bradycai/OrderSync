import { CHANNEL_LABELS } from "@orderwatch/shared";
import { useStore } from "../store";

export function Inventory() {
  const { inventory, pendingMatches } = useStore();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Inventory</h1>
        <p className="sub">
          Starting stock is never edited by an import. Committed units are recalculated
          server-side from live orders on every request, so the same notification twice
          can't double-count.
        </p>
      </header>

      {pendingMatches.length > 0 && (
        <section className="callout callout-warn">
          <strong>
            {pendingMatches.length} uncertain product match
            {pendingMatches.length === 1 ? "" : "es"} awaiting confirmation.
          </strong>
          <ul>
            {pendingMatches.map((m) => (
              <li key={m.id}>
                {CHANNEL_LABELS[m.channel]}: “{m.listingTitle}” → {m.sku}{" "}
                <span className="fine">
                  ({Math.round(m.confidence * 100)}% confidence — excluded from stock math
                  until confirmed on import)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>SKU</th><th>Product</th>
            <th className="num">Starting stock</th>
            <th className="num">Committed</th>
            <th className="num">Available</th>
            <th>Mapped listings</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((r) => (
            <tr key={r.sku} className={r.isShort ? "row-critical" : r.isLow ? "row-warn" : undefined}>
              <td className="mono">{r.sku}</td>
              <td>{r.title} — {r.color} / {r.size}</td>
              <td className="num">{r.startingStock}</td>
              <td className="num">{r.committed}</td>
              <td className="num strong">{r.available}</td>
              <td className="fine">
                {r.mappedChannels.map((c) => CHANNEL_LABELS[c]).join(", ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
