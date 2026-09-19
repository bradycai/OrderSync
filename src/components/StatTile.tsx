import type { ReactNode } from "react";

/**
 * A metric tile. When `onClick` is given it becomes a real button that takes
 * the founder to the view that explains the number.
 */
export function StatTile({
  label,
  value,
  tone = "neutral",
  note,
  onClick,
  actionLabel,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "warn";
  note?: ReactNode;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const toneStyles =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
      : "border-zinc-200 bg-white hover:border-zinc-300";

  const valueStyles = tone === "warn" ? "text-amber-900" : "text-zinc-900";

  const content = (
    <>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-semibold tabular-nums tracking-tight ${valueStyles}`}>
          {value}
        </span>
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-600">{label}</div>
      {note && <div className="mt-1.5 text-xs leading-relaxed text-zinc-500">{note}</div>}
      {onClick && actionLabel && (
        <div className="mt-2.5 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
          {actionLabel} →
        </div>
      )}
    </>
  );

  const base = `group flex flex-col rounded-xl border px-4 py-3.5 text-left shadow-xs transition-colors duration-100 ${toneStyles}`;

  if (!onClick) return <div className={base}>{content}</div>;

  return (
    <button type="button" onClick={onClick} className={`${base} cursor-pointer`}>
      {content}
    </button>
  );
}
