import type { TimingRun } from "@orderwatch/shared";

/**
 * Lets the founder time the same reconciliation twice during a demo — once by
 * hand, once with OrderSync — and compare. We record only what was measured
 * here; no time-savings figure is claimed anywhere in the product.
 */
export const startRun = (mode: TimingRun["mode"], label: string): TimingRun => ({
  id: `${mode}-${Date.now()}`,
  mode,
  label,
  startedAt: new Date().toISOString(),
});

export function stopRun(run: TimingRun): TimingRun {
  const endedAt = new Date().toISOString();
  return {
    ...run,
    endedAt,
    seconds: Math.round((+new Date(endedAt) - +new Date(run.startedAt)) / 1000),
  };
}

export const formatSeconds = (s?: number) =>
  s == null ? "—" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
