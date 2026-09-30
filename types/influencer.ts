export type InfluencerPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "naver_blog"
  | "xiaohongshu";

export type InfluencerChannel = {
  id?: string;

  influencer_id?: string;

  platform: InfluencerPlatform;

  channel_name: string | null;

  handle: string | null;

  url: string | null;

  followers: number | null;

  avg_views: number | null;

  collaboration_rate: number | null;

  is_primary: boolean;

  memo?: string | null;

  rates?: InfluencerChannelRate[];
};

export type Influencer = {
  id: string;

  name: string;

  email: string | null;

  category: string | null;

  categories?: string[] | null;

  gender: string | null;

  age_group: string | null;

  collaboration_rate: number | null;

  memo: string | null;

  channels?: InfluencerChannel[];
};

export type InfluencerChannelRate = {
  id?: string;
  channel_id?: string;
  content_type: string;
  rate: number | null;
  memo?: string | null;
};