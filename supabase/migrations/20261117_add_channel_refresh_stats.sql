-- Campaign-selected influencer stats refresh
-- Instagram channel-level current metrics

alter table public.influencer_channels
  add column if not exists ad_avg_views bigint,
  add column if not exists ad_posts_sampled integer,
  add column if not exists stats_updated_at timestamptz,
  add column if not exists stats_source text;

comment on column public.influencer_channels.ad_avg_views
  is 'Average views of the latest up to 3 detected advertising/sponsored posts.';

comment on column public.influencer_channels.ad_posts_sampled
  is 'Number of detected advertising posts used to calculate ad_avg_views.';

comment on column public.influencer_channels.stats_updated_at
  is 'Timestamp when channel follower/view statistics were last refreshed.';

comment on column public.influencer_channels.stats_source
  is 'Source used for the latest channel statistics refresh.';
