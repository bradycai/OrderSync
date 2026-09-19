import { Icon, type IconName } from "./Icon";
export function StatTile({
  label,
  value,
  tone = "neutral",
  note,
  icon = "box",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "warn" | "critical";
  note?: string;
  icon?: IconName;
}) {
  return (
    <div className={`tile tile-${tone}`}>
      <div className="tile-top">
        <span className="tile-label">{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <div className="tile-value">
        {typeof value === "number" ? String(value).padStart(2, "0") : value}
      </div>
      {note && (
        <div className="tile-note">
          <span />
          {note}
        </div>
      )}
    </div>
  );
}
