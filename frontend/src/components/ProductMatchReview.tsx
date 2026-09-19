import { useCallback, useEffect, useState } from "react";
import { CHANNEL_LABELS, type Channel } from "@orderwatch/shared";
import { useStore } from "../store";

type Match = { channel: Channel; listingTitle: string; suggestedSku: string | null; orderKeys: string[] };

export function ProductMatchReview() {
  const { inventory, refresh } = useStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/inventory/matches");
    if (!response.ok) throw new Error("Could not load product matches.");
    setMatches((await response.json()).matches);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load, inventory]);

  async function confirm(match: Match, sku: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/inventory/matches/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: match.channel, listingTitle: match.listingTitle, sku }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not confirm match.");
      await Promise.all([load(), refresh()]);
      setNotice(`Confirmed ${sku} for ${result.updatedLines} order line(s). Inventory and alerts have been recalculated.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <section aria-label="Product match review">
    {matches.length > 0 && <div className="card">
      <h2>Confirm product matches</h2>
      <p className="fine">These order lines do not reserve stock until you confirm a SKU. Check the garment, color, and size. You can choose a different product from the suggestion.</p>
      {matches.map(match => {
        const key = JSON.stringify([match.channel, match.listingTitle]);
        const selected = choices[key] ?? match.suggestedSku ?? "";
        return <div className="card" key={key}>
          <strong>{CHANNEL_LABELS[match.channel]}: {match.listingTitle}</strong>
          <p className="fine">{match.orderKeys.length} order(s) awaiting review. {match.suggestedSku ? `Suggested: ${match.suggestedSku}` : "No suggested match — select a product below."}</p>
          <label>
            <span className="fine">Confirmed product</span>
            <select className="search wide" value={selected} disabled={busy} onChange={e => setChoices(c => ({ ...c, [key]: e.target.value }))}>
              <option value="">Leave pending — select a SKU to confirm</option>
              {inventory.map(p => <option key={p.sku} value={p.sku}>{p.title} · {p.color} / {p.size} ({p.sku})</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={busy || !selected} onClick={() => void confirm(match, selected)}>{busy ? "Saving…" : "Confirm match and recalculate"}</button>
        </div>;
      })}
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
  </section>;
}
