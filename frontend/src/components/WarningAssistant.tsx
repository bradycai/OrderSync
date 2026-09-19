import { useState } from "react";
import { autoResolveReason } from "@orderwatch/shared";
import { useStore } from "../store";

type Result = { alertId: string; title: string; status: "handled" | "skipped" | "failed"; reason: string; draft?: string; demoMode?: boolean };
export function WarningAssistant() {
  const { alerts, actions, orders, supportingOrders, refresh, demoMode } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const allOrders = [...new Map([...orders, ...supportingOrders].map(o => [o.key, o])).values()];
  const eligible = alerts.filter(a => !autoResolveReason(a, alerts, allOrders, actions)).length;
  async function run() {
    setBusy(true); setError(""); setResults(null);
    try {
      const response = await fetch("/api/alerts/auto-resolve", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Assistant failed.");
      setResults(body.results);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card" aria-label="AI warning assistant">
    <h2>AI warning assistant</h2>
    <p>Handle routine overdue warnings in one click. Critical issues, stock shortages, uncertain matches, and items already under review stay with you.</p>
    <p className="fine">Simulated only: prepares and records a customer follow-up. No messages, refunds, stock changes, or fulfillment updates. Handled warnings move to resolved history; order fulfillment stays unchanged.</p>
    {demoMode && <p className="pill pill-demo">Demo mode · prepared messages, no live AI</p>}
    <div className="actions-row">
      <button className="btn btn-primary" disabled={busy || eligible === 0} onClick={() => void run()}>{busy ? "Handling warnings…" : `Auto-resolve ${eligible} warning${eligible === 1 ? "" : "s"} (simulated)`}</button>
      <span className="fine">{alerts.filter(a => a.severity === "critical").length} critical issue(s) reserved for manual review</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {results && <div aria-live="polite">
      <p>{results.filter(r => r.status === "handled").length} resolved · {results.filter(r => r.status === "skipped").length} left alone · {results.filter(r => r.status === "failed").length} failed</p>
      {results.map(r => <details key={r.alertId}><summary>{r.title} — {r.status === "handled" ? "resolved (simulated)" : r.status}</summary><p>{r.reason}</p>{r.draft && <><p className="fine">{r.demoMode ? "Prepared demo output" : "AI-generated follow-up"} · simulated, never sent</p><p style={{ whiteSpace: "pre-wrap" }}>{r.draft}</p></>}</details>)}
    </div>}
  </section>;
}
