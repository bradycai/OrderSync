import { CHANNEL_LABELS, type Channel } from "../types";

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <span className={`badge badge-${channel}`}>{CHANNEL_LABELS[channel]}</span>;
}
