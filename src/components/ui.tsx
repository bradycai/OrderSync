import type { ButtonHTMLAttributes, ReactNode } from "react";

/* Small shared primitives. Calm surfaces, amber for anything that needs a
 * human — red is deliberately absent from the whole palette. */

type Variant = "primary" | "secondary" | "ghost" | "approve" | "amber";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 shadow-sm disabled:bg-zinc-300",
  secondary:
    "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-xs disabled:text-zinc-400",
  ghost:
    "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300",
  approve:
    "bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:bg-indigo-300",
  amber:
    "bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200/70 disabled:opacity-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-xs px-2.5 py-1.5 rounded-md gap-1.5",
    md: "text-sm px-3.5 py-2 rounded-lg gap-2",
    lg: "text-sm px-5 py-2.5 rounded-lg gap-2 font-semibold",
  };
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-colors duration-100 disabled:cursor-not-allowed ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type Tone = "neutral" | "amber" | "emerald" | "indigo" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  muted: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

export function Pill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}

/** Marks synthetic seed data, per the honesty requirements. */
export function SampleTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Synthetic data created for this prototype"
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 bg-zinc-100 ring-1 ring-inset ring-zinc-200 ${className}`}
    >
      sample data
    </span>
  );
}

/** Marks anything that would otherwise look like a real outward action. */
export function SimulatedTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Recorded in this prototype only — nothing leaves your machine"
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700 bg-indigo-50 ring-1 ring-inset ring-indigo-200 ${className}`}
    >
      simulated
    </span>
  );
}

export function Callout({
  tone = "amber",
  children,
  className = "",
}: {
  tone?: "amber" | "neutral" | "indigo";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    amber: "bg-amber-50/70 border-amber-200 text-amber-900",
    neutral: "bg-zinc-50 border-zinc-200 text-zinc-700",
    indigo: "bg-indigo-50/70 border-indigo-200 text-indigo-900",
  };
  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-zinc-500">{body}</p>}
    </div>
  );
}

/** Definition list used across detail panes. */
export function Kv({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-zinc-500">{item.k}</dt>
          <dd className="text-zinc-900">{item.v}</dd>
        </div>
      ))}
    </dl>
  );
}
