import { isLow } from "../lib/inventory";
import { useStore } from "../store";
import { CHANNEL_LABELS } from "../types";

export function Inventory() {
  const { products, snapshots, listingMaps } = useStore();
  const pending = listingMaps.filter((m) => m.status === "pending");

  return (
    <div className="page">
      <header className="page-head">
        <h1>Inventory</h1>
        <p className="sub">
          Starting stock is never edited by an import. Committed units are recomputed from
          live orders, so the same notification twice can't double-count.
        </p>
      </header>

      {pending.length > 0 && (
        <section className="callout callout-warn">
          <strong>{pending.length} uncertain product match{pending.length === 1 ? "" : "es"} awaiting confirmation.</strong>
          <ul>
            {pending.map((m) => (
              <li key={m.id}>
                {CHANNEL_LABELS[m.channel]}: “{m.listingTitle}” → {m.sku}{" "}
                <span className="fine">({Math.round(m.confidence * 100)}% confidence — excluded from stock math until confirmed)</span>
                {/* TODO: wire confirm / reject to setListingMaps */}
              </li>
            ))}
          </ul>
        </section>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th className="num">Starting stock</th>
            <th className="num">Committed</th>
            <th className="num">Available</th>
            <th>Mapped listings</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => {
            const p = products.find((x) => x.sku === s.sku)!;
            const maps = listingMaps.filter((m) => m.sku === s.sku && m.status === "confirmed");
            return (
              <tr key={s.sku} className={s.available < 0 ? "row-critical" : isLow(s) ? "row-warn" : undefined}>
                <td className="mono">{s.sku}</td>
                <td>{p.title} — {p.color} / {p.size}</td>
                <td className="num">{s.startingStock}</td>
                <td className="num">{s.committed}</td>
                <td className="num strong">{s.available}</td>
                <td className="fine">{maps.map((m) => CHANNEL_LABELS[m.channel]).join(", ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
