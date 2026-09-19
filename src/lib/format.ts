/** Presentation-only helpers. No business rules live here. */

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Human phrasing for a shipping deadline relative to the demo clock. */
export function deadlineLabel(shipBy: string, now: Date): { text: string; late: boolean } {
  const diffMs = new Date(shipBy).getTime() - now.getTime();
  const late = diffMs < 0;
  const hours = Math.round(Math.abs(diffMs) / 3_600_000);

  if (hours < 24) {
    return { text: late ? `${hours}h overdue` : `in ${hours}h`, late };
  }
  const days = Math.round(hours / 24);
  return {
    text: late ? `${days}d overdue` : `in ${days}d`,
    late,
  };
}
