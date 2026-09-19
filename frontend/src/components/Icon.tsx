export type IconName =
  | "overview"
  | "inventory"
  | "intake"
  | "attention"
  | "timing"
  | "arrow"
  | "search"
  | "reset"
  | "check"
  | "box"
  | "spark"
  | "calendar";
const paths: Record<IconName, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inventory: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4v5",
  intake: "M3 5h18v14H3z m0 0 9 8 9-8",
  attention: "m12 3 10 18H2L12 3Zm0 6v5m0 3v.1",
  timing:
    "M9 2h6m-3 0v3m6 1 2-2 M12 9v5l3 2 M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2 5 5",
  reset: "M3 10a9 9 0 1 1 2 8M3 4v6h6",
  check: "m5 12 4 4L19 6",
  box: "M3 8h18v13H3zM2 3h20v5H2zM9 12h6",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  calendar: "M3 5h18v16H3zM7 2v6m10-6v6M3 11h18",
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
