import { useStore, type View } from "../store";
import { Button } from "./ui";

const ICONS: Record<View, string> = {
  overview: "M2.5 5.5h11M2.5 8h11M2.5 10.5h11M2.5 3h11",
  intake: "M2.5 4.5h11v7h-11v-7Zm0 .5L8 9l5.5-4",
  attention: "M8 5.5v3M8 11h.01M7.1 2.6 1.9 11.6a1 1 0 0 0 .9 1.5h10.4a1 1 0 0 0 .9-1.5L8.9 2.6a1 1 0 0 0-1.8 0Z",
  inventory: "M2.5 5.5 8 2.5l5.5 3v5L8 13.5l-5.5-3v-5Zm0 0L8 8.5m0 0 5.5-3M8 8.5v5",
  timing: "M8 4.5V8l2.2 1.3M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z",
};

const NAV: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Orders across all channels" },
  { id: "attention", label: "Needs attention", hint: "Shortages and overdue orders" },
  { id: "inventory", label: "Inventory", hint: "Stock, committed, available" },
  { id: "intake", label: "Import email", hint: "Paste an order notification" },
  { id: "timing", label: "Demo timer", hint: "Manual vs assisted" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function Sidebar() {
  const { view, setView, openAlerts, pendingMatches, handleResetDemo } = useStore();

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-[11px] font-bold tracking-tight text-white">
          OW
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight text-zinc-900">
            OrderWatch
          </div>
          <div className="truncate text-xs text-zinc-500">Operations assistant</div>
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 px-2 py-2">
        {NAV.map((item) => {
          const active = view === item.id;
          const count =
            item.id === "attention"
              ? openAlerts.length
              : item.id === "inventory"
                ? pendingMatches.length
                : 0;
          return (
            <li key={item.id}>
              <button
                type="button"
                title={item.hint}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-100 ${
                  active
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <NavIcon d={ICONS[item.id]} />
                <span className="flex-1 text-left">{item.label}</span>
                {count > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-800 ring-1 ring-inset ring-amber-200">
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-zinc-200 p-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={handleResetDemo}>
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2.5V6H10" />
          </svg>
          Reset demo
        </Button>
        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
          All data is synthetic. Every send and stock update is simulated — nothing leaves
          this machine.
        </p>
      </div>
    </nav>
  );
}
