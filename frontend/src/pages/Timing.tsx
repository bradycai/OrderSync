import { useState } from "react";
import type { TimingRun } from "@orderwatch/shared";
import { formatSeconds, startRun, stopRun } from "../lib/timing";
import { useStore } from "../store";

/**
 * Records what actually happened during this demo. OrderWatch makes no
 * time-savings claim of its own — the numbers here are whatever you measure.
 */
export function Timing() {
  const { timings, setTimings } = useStore();
  const [active, setActive] = useState<TimingRun | null>(null);
  const [label, setLabel] = useState("Reconcile the black hoodie shortage");

  const begin = (mode: TimingRun["mode"]) => setActive(startRun(mode, label));

  function end() {
    if (!active) return;
    setTimings([stopRun(active), ...timings]);
    setActive(null);
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Demo timer</h1>
        <p className="sub">Time the same task by hand, then with OrderWatch, and compare.</p>
      </header>

      <div className="card">
        <input className="search wide" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="actions-row">
          <button className="btn" disabled={!!active} onClick={() => begin("manual")}>Start manual</button>
          <button className="btn" disabled={!!active} onClick={() => begin("assisted")}>Start assisted</button>
          <button className="btn btn-primary" disabled={!active} onClick={end}>Stop</button>
          {active && <span className="fine">Running: {active.mode} — {active.label}</span>}
        </div>
      </div>

      <table className="table">
        <thead>
          <tr><th>Mode</th><th>Task</th><th>Started</th><th className="num">Duration</th></tr>
        </thead>
        <tbody>
          {timings.map((t) => (
            <tr key={t.id}>
              <td>{t.mode}</td>
              <td>{t.label}</td>
              <td className="fine">{new Date(t.startedAt).toLocaleTimeString()}</td>
              <td className="num">{formatSeconds(t.seconds)}</td>
            </tr>
          ))}
          {timings.length === 0 && <tr><td colSpan={4} className="empty">No runs recorded yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
