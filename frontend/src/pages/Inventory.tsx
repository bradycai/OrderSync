import { useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { Icon } from "../components/Icon";
import { ProductMatchReview } from "../components/ProductMatchReview";
import { useStore } from "../store";

export function Inventory() {
  const { inventory, pendingMatches } = useStore();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const rows = inventory.filter((r) =>
    `${r.title} ${r.color} ${r.size} ${r.sku}`.toLowerCase().includes(needle),
  );

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">ONE PRODUCT. EVERY MARKETPLACE.</p>
        <h1>Inventory, in harmony.</h1>
        <p className="sub">
          Starting stock is never edited by an import. Committed units are
          recalculated server-side from live orders on every request, so the
          same notification twice can't double-count.
        </p>
      </header>

      <ProductMatchReview />

      <div className="toolbar">
        <span className="inventory-summary">
          <Icon name="inventory" size={17} />
          {inventory.length} shared SKUs ·{" "}
          {pendingMatches.length} listings awaiting review
        </span>
        <input
          className="search"
          aria-label="Search inventory"
          placeholder="Search product or SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Product / shared SKU</th>
              <th>Variant</th>
              <th className="num">Starting stock</th>
              <th className="num">Committed</th>
              <th className="num">Available</th>
              <th>Stock status</th>
              <th>Mapped listings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.sku}
                className={
                  r.isShort ? "row-critical" : r.isLow ? "row-warn" : undefined
                }
              >
                <td>
                  <strong>{r.title}</strong>
                  <div className="fine mono">{r.sku}</div>
                </td>
                <td>
                  {r.color} / {r.size}
                </td>
                <td className="num">{r.startingStock}</td>
                <td className="num">{r.committed}</td>
                <td className={`num strong ${r.isShort ? "overdue" : ""}`}>
                  {r.available}
                </td>
                <td>
                  <span
                    className={`pill ${r.isShort ? "pill-critical" : r.isLow ? "pill-warn" : "pill-demo"}`}
                  >
                    {r.isShort
                      ? `${Math.abs(r.available)} short`
                      : r.isLow
                        ? "Running low"
                        : "In stock"}
                  </span>
                </td>
                <td className="fine">
                  {r.mappedChannels.length > 0
                    ? r.mappedChannels.map((c) => (
                        <ChannelBadge channel={c} key={c} />
                      ))
                    : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No products match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="fine" style={{ marginTop: 12 }}>
        Starting stock − committed units = available stock. Canceled, shipped,
        and unmatched orders do not hold stock.
      </p>
    </div>
  );
}
