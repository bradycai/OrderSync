import { useEffect, useState } from "react";
import { formatSeconds, startRun, stopRun } from "../lib/timing";
import { useStore } from "../store";
import type { TimingRun } from "../types";

/**
 * Records what actually happened during this demo. OrderWatch makes no
 * time-savings claim of its own — the numbers here are whatever you measure.
 */
export function Timing() {
  const { timings, setTimings } = useStore();
  const [active, setActive] = useState<TimingRun | null>(null);
  const [label, setLabel] = useState("Reconcile the black hoodie shortage");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    setElapsed(0);
    const interval = window.setInterval(
      () =>
        setElapsed(
          Math.floor(
            (Date.now() - new Date(active.startedAt).getTime()) / 1000,
          ),
        ),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [active]);

  const begin = (mode: TimingRun["mode"]) => setActive(startRun(mode, label));

  function end() {
    if (!active) return;
    setTimings([stopRun(active), ...timings]);
    setActive(null);
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">MEASURE YOUR OWN MOMENTUM</p>
        <h1>Demo timer</h1>
        <p className="sub">
          Time the same task by hand, then with OrderWatch, and compare.
        </p>
      </header>

      <div className="card">
        <label className="form-label" htmlFor="timing-task">
          What are you reconciling?
        </label>
        <input
          id="timing-task"
          disabled={!!active}
          className="search wide"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="timer-display">
          {formatSeconds(active ? elapsed : 0)}
        </div>
        <p className="fine">
          Record the same task manually and with assistance. These are your
          measurements, not a time-savings claim. Keep this page open during a
          run.
        </p>
        <div className="actions-row">
          <button
            className="btn"
            disabled={!!active}
            onClick={() => begin("manual")}
          >
            Start manual
          </button>
          <button
            className="btn"
            disabled={!!active}
            onClick={() => begin("assisted")}
          >
            Start assisted
          </button>
          <button className="btn btn-primary" disabled={!active} onClick={end}>
            Stop
          </button>
          {active && (
            <span className="fine">
              Running: {active.mode} — {active.label}
            </span>
          )}
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Mode</th>
            <th>Task</th>
            <th>Started</th>
            <th className="num">Duration</th>
          </tr>
        </thead>
        <tbody>
          {timings.map((t) => (
            <tr key={t.id}>
              <td>{t.mode}</td>
              <td>{t.label}</td>
              <td className="fine">
                {new Date(t.startedAt).toLocaleTimeString()}
              </td>
              <td className="num">{formatSeconds(t.seconds)}</td>
            </tr>
          ))}
          {timings.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                No runs recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
