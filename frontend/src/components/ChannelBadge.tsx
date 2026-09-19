import { CHANNEL_LABELS, type Channel } from "@orderwatch/shared";

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <span className={`badge badge-${channel}`}>{CHANNEL_LABELS[channel]}</span>;
}
