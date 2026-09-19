import { useState } from "react";
import { ChannelBadge } from "../components/ChannelBadge";
import { Icon } from "../components/Icon";
import { isLow } from "../lib/inventory";
import { useStore } from "../store";
export function Inventory() {
  const { products, snapshots, listingMaps, reviewMatch } = useStore();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const pending = listingMaps.filter((m) => m.status === "pending");
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">ONE PRODUCT. EVERY MARKETPLACE.</p>
        <h1>Inventory, in harmony.</h1>
        <p className="sub">
          A shared stock picture across your channels. Starting stock stays
          separate from active order commitments.
        </p>
      </header>
      {notice && (
        <p className="callout" role="status">
          {notice}
        </p>
      )}
      {pending.length > 0 && (
        <section className="callout callout-warn">
          <strong>{pending.length} product match needs a second look</strong>
          <p className="fine">
            These prepared sample suggestions do not affect inventory until you
            confirm them.
          </p>
          {pending.map((m) => (
            <div className="mapping-review" key={m.id}>
              <div>
                <ChannelBadge channel={m.channel} />
                <p>
                  “{m.listingTitle}” → <strong>{m.sku}</strong>
                </p>
                <p>
                  {Math.round(m.confidence * 100)}% sample confidence · check
                  the product, color, and size
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  reviewMatch(m.id, true);
                  setNotice(
                    `Match confirmed for ${m.sku}. Existing orders and inventory have been recalculated.`,
                  );
                }}
              >
                <Icon name="check" size={15} />
                Confirm match
              </button>
              <button
                className="btn"
                onClick={() => {
                  reviewMatch(m.id, false);
                  setNotice(
                    "Suggestion rejected. This listing remains unmatched and excluded from stock commitments.",
                  );
                }}
              >
                Not a match
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="toolbar">
        <span className="inventory-summary">
          <Icon name="inventory" size={17} />
          {products.length} shared SKUs ·{" "}
          {listingMaps.filter((m) => m.status === "confirmed").length} confirmed
          listings
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
            </tr>
          </thead>
          <tbody>
            {snapshots
              .filter((s) => {
                const p = products.find((p) => p.sku === s.sku)!;
                return `${p.title} ${p.color} ${p.size} ${s.sku}`
                  .toLowerCase()
                  .includes(query.trim().toLowerCase());
              })
              .map((s) => {
                const p = products.find((x) => x.sku === s.sku)!;
                return (
                  <tr key={s.sku}>
                    <td>
                      <strong>{p.title}</strong>
                      <div className="fine mono">{s.sku}</div>
                    </td>
                    <td>
                      {p.color} / {p.size}
                    </td>
                    <td className="num">{s.startingStock}</td>
                    <td className="num">{s.committed}</td>
                    <td
                      className={`num strong ${s.available < 0 ? "overdue" : ""}`}
                    >
                      {s.available}
                    </td>
                    <td>
                      <span
                        className={`pill ${s.available < 0 ? "pill-critical" : isLow(s) ? "pill-warn" : "pill-demo"}`}
                      >
                        {s.available < 0
                          ? `${Math.abs(s.available)} short`
                          : isLow(s)
                            ? "Running low"
                            : "In stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            {!products.some((p) =>
              `${p.title} ${p.color} ${p.size} ${p.sku}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            ) && (
              <tr>
                <td colSpan={6} className="empty">
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
      <section className="card" style={{ marginTop: 28 }}>
        <div className="section-title">
          <h2>Different names. The same product.</h2>
          <span className="fine">Marketplace listing map</span>
        </div>
        <div className="table-scroll">
          <table className="table compact">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Marketplace listing</th>
                <th>Shared SKU</th>
                <th>Match status</th>
              </tr>
            </thead>
            <tbody>
              {listingMaps.map((m) => (
                <tr key={m.id}>
                  <td>
                    <ChannelBadge channel={m.channel} />
                  </td>
                  <td>{m.listingTitle}</td>
                  <td className="mono">{m.sku}</td>
                  <td>
                    <span
                      className={`pill ${m.status === "confirmed" ? "pill-demo" : "pill-warn"}`}
                    >
                      {m.status === "confirmed"
                        ? "Confirmed"
                        : m.status === "pending"
                          ? "Needs review"
                          : "Rejected"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
