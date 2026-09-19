import { useEffect, useState } from "react";
import { Button, Callout, EmptyState, Pill } from "../components/ui";
import { formatSeconds } from "../lib/timing";
import { fmtTime } from "../lib/format";
import { useStore } from "../store";

/**
 * Records what actually happened during this demo. OrderWatch states no
 * time-savings figure of its own — the comparison below is populated purely
 * from runs measured here, and stays empty until both have been recorded.
 */
export function Timing() {
  const { timings, activeRun, handleStartTimer, handleStopTimer, handleClearTimings } =
    useStore();

  const [label, setLabel] = useState("Reconcile the black hoodie shortage");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeRun) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Math.floor((Date.now() - new Date(activeRun.startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [activeRun]);

  const lastManual = timings.find((t) => t.mode === "manual" && t.seconds != null);
  const lastAssisted = timings.find((t) => t.mode === "assisted" && t.seconds != null);
  const bothRecorded = Boolean(lastManual && lastAssisted);
  const delta =
    lastManual?.seconds != null && lastAssisted?.seconds != null
      ? lastManual.seconds - lastAssisted.seconds
      : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Demo timer</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-500">
          Time the same reconciliation by hand, then with OrderWatch, and compare. This app
          makes no time-savings claim — whatever you measure here is the only number that
          appears.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs">
        <label htmlFor="task" className="block text-xs font-medium text-zinc-500">
          Task being timed
        </label>
        <input
          id="task"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={!!activeRun}
          className="mt-1.5 w-full max-w-lg rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 disabled:bg-zinc-50 disabled:text-zinc-500"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {activeRun ? (
            <>
              <div className="flex items-baseline gap-2.5 rounded-lg bg-zinc-900 px-4 py-2.5">
                <span className="text-2xl font-semibold tabular-nums text-white">
                  {formatSeconds(elapsed)}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {activeRun.mode}
                </span>
              </div>
              <Button variant="approve" size="lg" onClick={handleStopTimer}>
                Stop and record
              </Button>
              <span className="text-sm text-zinc-500">{activeRun.label}</span>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="lg"
                disabled={!label.trim()}
                onClick={() => handleStartTimer("manual", label)}
              >
                Start manual run
              </Button>
              <Button
                variant="secondary"
                size="lg"
                disabled={!label.trim()}
                onClick={() => handleStartTimer("assisted", label)}
              >
                Start assisted run
              </Button>
              <span className="text-sm text-zinc-500">
                Run the same task both ways to populate the comparison.
              </span>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ResultCard
          title="Manual"
          value={lastManual?.seconds != null ? formatSeconds(lastManual.seconds) : "not measured"}
          measured={lastManual?.seconds != null}
        />
        <ResultCard
          title="With OrderWatch"
          value={
            lastAssisted?.seconds != null ? formatSeconds(lastAssisted.seconds) : "not measured"
          }
          measured={lastAssisted?.seconds != null}
        />
        <ResultCard
          title="Difference"
          value={
            delta == null
              ? "not measured"
              : `${delta >= 0 ? "−" : "+"}${formatSeconds(Math.abs(delta))}`
          }
          measured={bothRecorded}
        />
      </section>

      {!bothRecorded && (
        <Callout tone="neutral">
          The comparison stays empty until you have recorded both a manual and an assisted
          run. No placeholder or illustrative figure is shown in its place.
        </Callout>
      )}

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Recorded runs ({timings.length})
          </h2>
          {timings.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearTimings}>
              Clear runs
            </Button>
          )}
        </div>

        {timings.length === 0 ? (
          <EmptyState
            title="No runs recorded yet"
            body="Start a manual run, do the reconciliation by hand, then stop. Repeat with the assisted run."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                  <th className="px-4 py-2.5 text-left font-medium">Task</th>
                  <th className="px-4 py-2.5 text-left font-medium">Started</th>
                  <th className="px-4 py-2.5 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {timings.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5">
                      <Pill tone={t.mode === "assisted" ? "indigo" : "neutral"}>{t.mode}</Pill>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-800">{t.label}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {fmtTime(t.startedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-900">
                      {formatSeconds(t.seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ResultCard({
  title,
  value,
  measured,
}: {
  title: string;
  value: string;
  measured: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        measured ? "border-zinc-200 bg-white" : "border-dashed border-zinc-200 bg-white/50"
      }`}
    >
      <div className="text-xs font-medium text-zinc-500">{title}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
          measured ? "text-zinc-900" : "text-zinc-300"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-zinc-400">
        {measured ? "measured in this session" : "awaiting a recorded run"}
      </div>
    </div>
  );
}
