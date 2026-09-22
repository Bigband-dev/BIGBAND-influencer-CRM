import type {
  InfluencerPlatform,
} from "@/types/influencer";

type Props = {
  platform: InfluencerPlatform;
  compact?: boolean;
};

const platformConfig: Record<
  InfluencerPlatform,
  {
    label: string;
    shortLabel: string;
    className: string;
  }
> = {
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    className:
      "border-pink-200 bg-pink-50 text-pink-700",
  },

  youtube: {
    label: "YouTube",
    shortLabel: "YT",
    className:
      "border-red-200 bg-red-50 text-red-700",
  },

  tiktok: {
    label: "TikTok",
    shortLabel: "TikTok",
    className:
      "border-slate-300 bg-slate-100 text-slate-800",
  },

  naver_blog: {
    label: "Naver Blog",
    shortLabel: "Blog",
    className:
      "border-green-200 bg-green-50 text-green-700",
  },

  xiaohongshu: {
    label: "Xiaohongshu",
    shortLabel: "RED",
    className:
      "border-rose-200 bg-rose-50 text-rose-700",
  },
};

export default function PlatformBadge({
  platform,
  compact = false,
}: Props) {
  const config =
    platformConfig[platform];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {compact
        ? config.shortLabel
        : config.label}
    </span>
  );
}