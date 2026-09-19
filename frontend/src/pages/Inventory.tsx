import { CHANNEL_LABELS } from "@orderwatch/shared";
import { ProductMatchReview } from "../components/ProductMatchReview";
import { useStore } from "../store";

export function Inventory() {
  const { inventory } = useStore();

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

      <ProductMatchReview />

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
