import { useStore } from "../store";
import { SimulatedTag } from "./ui";

/**
 * Confirmation surface for actions the founder just approved. Anything that
 * would look like an outward action is labeled `simulated` right in the toast.
 */
export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-toast-in pointer-events-auto w-80 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-lg shadow-zinc-900/5"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
                {t.tone === "simulated" && <SimulatedTag />}
              </div>
              {t.body && (
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">{t.body}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              className="-m-1 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
