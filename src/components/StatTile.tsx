export function StatTile({
  label,
  value,
  tone = "neutral",
  note,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "warn" | "critical";
  note?: string;
}) {
  return (
    <div className={`tile tile-${tone}`}>
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}
