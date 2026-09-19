import { CHANNEL_LABELS, type Channel } from "../types";

/** One distinct hue and glyph per marketplace, so channels read at a glance. */
const STYLES: Record<Channel, { chip: string; icon: string }> = {
  shopify: {
    chip: "bg-shopify-soft text-shopify ring-shopify/20",
    // shopping bag
    icon: "M6 7V5.5a2 2 0 1 1 4 0V7M3.5 7h9l-.7 6.2a1.2 1.2 0 0 1-1.2 1.05H5.4a1.2 1.2 0 0 1-1.2-1.05L3.5 7Z",
  },
  tiktok: {
    chip: "bg-tiktok-soft text-tiktok ring-tiktok/20",
    // music note
    icon: "M6.5 11.5a2 2 0 1 1-2-2c.35 0 .7.09 1 .26V3.5l5-1v6.2M10.5 2.5c0 1.4 1 2.4 2.2 2.6",
  },
  amazon: {
    chip: "bg-amazon-soft text-amazon ring-amazon/20",
    // parcel box
    icon: "M8 2.5 13.5 5v6L8 13.5 2.5 11V5L8 2.5Zm0 0v11M2.5 5 8 7.5 13.5 5",
  },
  ebay: {
    chip: "bg-ebay-soft text-ebay ring-ebay/20",
    // price tag
    icon: "M8.7 2.5H13a.5.5 0 0 1 .5.5v4.3a1 1 0 0 1-.3.7l-5.3 5.3a1 1 0 0 1-1.4 0L3 9.8a1 1 0 0 1 0-1.4L8 3.1a1 1 0 0 1 .7-.6Zm2.3 3.1h.01",
  },
};

export function ChannelBadge({
  channel,
  compact = false,
}: {
  channel: Channel;
  compact?: boolean;
}) {
  const s = STYLES[channel];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight ring-1 ring-inset whitespace-nowrap ${s.chip}`}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={s.icon} />
      </svg>
      {!compact && CHANNEL_LABELS[channel]}
    </span>
  );
}
