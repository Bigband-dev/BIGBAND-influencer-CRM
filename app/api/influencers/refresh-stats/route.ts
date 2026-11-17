"use server";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createRouteSupabaseClient,
} from "@/lib/supabase/route-client";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

const INSTAGRAM_PROFILE_ACTOR_ID =
  process.env.APIFY_INSTAGRAM_PROFILE_ACTOR_ID ||
  "dami_studio~instagram-profile-scraper";

const AD_KEYWORDS = [
  "#광고",
  "#협찬",
  "#유료광고",
  "유료광고",
  "광고입니다",
  "광고 포함",
  "광고포함",
  "협찬",
  "제품제공",
  "제품 제공",
  "제품을 제공받",
  "소정의 원고료",
  "paid partnership",
  "paidpartnership",
  "sponsored",
  "#ad",
  "#sponsored",
];

type CampaignMemberRow = {
  id: string;
  influencer_id: string;
};

type InfluencerRow = {
  id: string;
  name: string | null;
  instagram_id: string | null;
  instagram_url: string | null;
  followers: number | null;
  avg_views: number | null;
};

type ChannelRow = {
  id: string;
  influencer_id: string;
  platform: string;
  channel_name: string | null;
  handle: string | null;
  url: string | null;
  followers: number | null;
  avg_views: number | null;
  is_primary: boolean | null;
};

function cleanUsername(value: unknown) {
  if (!value) return "";

  let username = String(value)
    .trim()
    .replace(/^@/, "");

  if (
    username.startsWith("http://") ||
    username.startsWith("https://") ||
    username.startsWith("www.")
  ) {
    try {
      const url = new URL(
        username.startsWith("http")
          ? username
          : `https://${username}`
      );

      const parts = url.pathname
        .split("/")
        .filter(Boolean);

      username = parts[0] || "";
    } catch {
      return "";
    }
  }

  return username
    .split("?")[0]
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(
    typeof value === "string"
      ? value.replace(/,/g, "")
      : value
  );

  return Number.isFinite(number)
    ? number
    : null;
}

function firstFiniteNumber(
  ...values: unknown[]
) {
  for (const value of values) {
    const number =
      toFiniteNumber(value);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function getPostText(post: any) {
  const caption =
    typeof post?.caption === "string"
      ? post.caption
      : post?.caption?.text;

  return [
    caption,
    post?.text,
    post?.description,
    post?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isAdvertisingPost(post: any) {
  if (
    post?.isSponsored === true ||
    post?.sponsored === true ||
    post?.isPaidPartnership === true ||
    post?.paidPartnership === true ||
    post?.is_paid_partnership === true
  ) {
    return true;
  }

  const text = getPostText(post);

  return AD_KEYWORDS.some((keyword) =>
    text.includes(keyword.toLowerCase())
  );
}

function getPostViewCount(post: any) {
  return firstFiniteNumber(
    post?.videoViewCount,
    post?.video_view_count,
    post?.videoPlayCount,
    post?.video_play_count,
    post?.playCount,
    post?.plays,
    post?.viewCount,
    post?.views,
    post?.videoViews,
    post?.video_views
  );
}

function getPostTimestamp(post: any) {
  const raw =
    post?.timestamp ??
    post?.takenAt ??
    post?.taken_at ??
    post?.createdAt ??
    post?.created_at ??
    post?.date;

  if (!raw) return 0;

  if (
    typeof raw === "number"
  ) {
    return raw > 10_000_000_000
      ? raw
      : raw * 1000;
  }

  const parsed = Date.parse(
    String(raw)
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function extractPosts(profile: any) {
  const candidates = [
    profile?.latestPosts,
    profile?.latest_posts,
    profile?.recentPosts,
    profile?.recent_posts,
    profile?.posts,
    profile?.items,
    profile?.edge_owner_to_timeline_media
      ?.edges,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate
      .map((item) =>
        item?.node ?? item
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          getPostTimestamp(b) -
          getPostTimestamp(a)
      );
  }

  return [];
}

function roundAverage(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function calculateProfileStats(
  profile: any
) {
  const followers =
    firstFiniteNumber(
      profile?.followersCount,
      profile?.followers_count,
      profile?.followers,
      profile?.followerCount
    );

  const posts = extractPosts(
    profile
  );

  /*
   * 일반 평균 조회수는 최신 게시물 중 view/play 수치가 실제로 있는
   * 최대 10개를 사용합니다. 이미지 게시물처럼 조회수가 없는 항목은 제외합니다.
   */
  const recentViewCounts = posts
    .map((post) => ({
      post,
      views: getPostViewCount(post),
    }))
    .filter(
      (
        item
      ): item is {
        post: any;
        views: number;
      } => item.views !== null
    )
    .slice(0, 10);

  const avgViews = roundAverage(
    recentViewCounts.map(
      (item) => item.views
    )
  );

  /*
   * 광고성 평균은 최신 광고성 게시물 중 조회수가 확인되는 3개만 사용합니다.
   */
  const adPosts = recentViewCounts
    .filter((item) =>
      isAdvertisingPost(item.post)
    )
    .slice(0, 3);

  const adAvgViews = roundAverage(
    adPosts.map(
      (item) => item.views
    )
  );

  return {
    followers,
    postsReturned: posts.length,
    avgViews,
    viewsSampled:
      recentViewCounts.length,
    adAvgViews,
    adPostsSampled:
      adPosts.length,
  };
}

async function runProfileScraper(
  token: string,
  usernames: string[]
) {
  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${INSTAGRAM_PROFILE_ACTOR_ID}/runs?token=${encodeURIComponent(
      token
    )}&waitForFinish=120`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        usernames,
        includeLatestPosts: true,
      }),
      cache: "no-store",
    }
  );

  const runData =
    await runResponse.json();

  if (!runResponse.ok) {
    throw new Error(
      runData?.error?.message ||
        runData?.message ||
        "Instagram Profile Scraper 실행에 실패했습니다."
    );
  }

  const datasetId =
    runData?.data?.defaultDatasetId;

  if (!datasetId) {
    throw new Error(
      "Apify 실행 결과의 Dataset ID를 찾지 못했습니다."
    );
  }

  const datasetResponse =
    await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(
        token
      )}&clean=true`,
      {
        cache: "no-store",
      }
    );

  const items =
    await datasetResponse.json();

  if (
    !datasetResponse.ok ||
    !Array.isArray(items)
  ) {
    throw new Error(
      "Apify Instagram 결과를 불러오지 못했습니다."
    );
  }

  return items;
}

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createRouteSupabaseClient(
        request
      );

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          message:
            "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as {
        campaignId?: unknown;
        campaignInfluencerIds?: unknown;
        apifyToken?: unknown;
      };

    const campaignId =
      String(
        body.campaignId ?? ""
      ).trim();

    const rawCampaignInfluencerIds =
      Array.isArray(
        body.campaignInfluencerIds
      )
        ? body.campaignInfluencerIds
        : [];

    const campaignInfluencerIds: string[] =
      Array.from(
        new Set<string>(
          rawCampaignInfluencerIds
            .map((value: unknown) =>
              String(value).trim()
            )
            .filter(
              (value): value is string =>
                value.length > 0
            )
        )
      );

    if (!campaignId) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "CAMPAIGN_ID_REQUIRED",
          message:
            "캠페인 ID가 없습니다.",
        },
        { status: 400 }
      );
    }

    if (
      campaignInfluencerIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "RECIPIENT_REQUIRED",
          message:
            "최신화할 인플루언서를 선택해주세요.",
        },
        { status: 400 }
      );
    }

    if (
      campaignInfluencerIds.length >
      100
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "TOO_MANY_RECIPIENTS",
          message:
            "한 번에 최대 100명까지 최신화할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const token = String(
      body?.apifyToken ||
        process.env
          .APIFY_API_TOKEN ||
        process.env.APIFY_TOKEN ||
        ""
    ).trim();

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "APIFY_TOKEN_REQUIRED",
          message:
            "Apify API Key가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const admin =
      createAdminClient();

    const {
      data: members,
      error: membersError,
    } = await admin
      .from(
        "campaign_influencers"
      )
      .select(
        "id, influencer_id"
      )
      .eq(
        "campaign_id",
        campaignId
      )
      .in(
        "id",
        campaignInfluencerIds
      );

    if (membersError) {
      throw new Error(
        `캠페인 인플루언서 조회 실패: ${membersError.message}`
      );
    }

    const memberRows =
      (members ??
        []) as CampaignMemberRow[];

    const memberMap =
      new Map(
        memberRows.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

    const influencerIds =
      Array.from(
        new Set(
          memberRows.map(
            (item) =>
              item.influencer_id
          )
        )
      );

    const {
      data: influencers,
      error: influencersError,
    } = await admin
      .from("influencers")
      .select(
        "id, name, instagram_id, instagram_url, followers, avg_views"
      )
      .in(
        "id",
        influencerIds
      );

    if (influencersError) {
      throw new Error(
        `인플루언서 조회 실패: ${influencersError.message}`
      );
    }

    const influencerMap =
      new Map(
        (
          (influencers ??
            []) as InfluencerRow[]
        ).map((item) => [
          item.id,
          item,
        ])
      );

    const {
      data: channels,
      error: channelsError,
    } = await admin
      .from(
        "influencer_channels"
      )
      .select(
        "id, influencer_id, platform, channel_name, handle, url, followers, avg_views, is_primary"
      )
      .in(
        "influencer_id",
        influencerIds
      );

    if (channelsError) {
      throw new Error(
        `채널 조회 실패: ${channelsError.message}`
      );
    }

    const allChannels =
      (channels ??
        []) as ChannelRow[];

    const channelsByInfluencer =
      new Map<
        string,
        ChannelRow[]
      >();

    for (const channel of
      allChannels) {
      const current =
        channelsByInfluencer.get(
          channel.influencer_id
        ) ?? [];

      current.push(channel);

      channelsByInfluencer.set(
        channel.influencer_id,
        current
      );
    }

    const targetByUsername =
      new Map<
        string,
        {
          campaignInfluencerId: string;
          influencer: InfluencerRow;
          channel: ChannelRow | null;
          username: string;
        }
      >();

    const results: Array<
      Record<string, unknown>
    > = [];

    for (const campaignInfluencerId of
      campaignInfluencerIds) {
      const member =
        memberMap.get(
          campaignInfluencerId
        );

      if (!member) {
        results.push({
          campaignInfluencerId,
          influencerId: "",
          name: null,
          username: null,
          status: "skipped",
          reason:
            "현재 캠페인에서 찾을 수 없음",
        });
        continue;
      }

      const influencer =
        influencerMap.get(
          member.influencer_id
        );

      if (!influencer) {
        results.push({
          campaignInfluencerId,
          influencerId:
            member.influencer_id,
          name: null,
          username: null,
          status: "skipped",
          reason:
            "인플루언서 정보를 찾을 수 없음",
        });
        continue;
      }

      const influencerChannels =
        channelsByInfluencer.get(
          influencer.id
        ) ?? [];

      const instagramChannel =
        influencerChannels.find(
          (channel) =>
            channel.platform ===
            "instagram"
        ) ?? null;

      const username =
        cleanUsername(
          instagramChannel?.handle ||
            instagramChannel?.url ||
            influencer.instagram_id ||
            influencer.instagram_url
        );

      if (!username) {
        results.push({
          campaignInfluencerId,
          influencerId:
            influencer.id,
          name:
            influencer.name,
          username: null,
          status: "skipped",
          reason:
            "Instagram 계정 없음",
        });
        continue;
      }

      /*
       * 같은 Instagram 계정이 캠페인에 중복 연결되는 비정상 상황이 있더라도
       * Apify에는 한 번만 요청합니다.
       */
      const key =
        username.toLowerCase();

      if (
        !targetByUsername.has(
          key
        )
      ) {
        targetByUsername.set(
          key,
          {
            campaignInfluencerId,
            influencer,
            channel:
              instagramChannel,
            username,
          }
        );
      }
    }

    const usernames =
      Array.from(
        targetByUsername.values()
      ).map(
        (target) =>
          target.username
      );

    if (
      usernames.length === 0
    ) {
      const skipped =
        results.filter(
          (item) =>
            item.status ===
            "skipped"
        ).length;

      return NextResponse.json({
        ok: true,
        updated: 0,
        skipped,
        failed: 0,
        results,
      });
    }

    const profiles =
      await runProfileScraper(
        token,
        usernames
      );

    const profileMap =
      new Map<string, any>();

    for (const profile of
      profiles) {
      const username =
        cleanUsername(
          profile?.username ||
            profile?.userName ||
            profile?.handle ||
            profile?.inputUrl ||
            profile?.url
        );

      if (!username) {
        continue;
      }

      profileMap.set(
        username.toLowerCase(),
        profile
      );
    }

    for (const target of
      targetByUsername.values()) {
      const {
        campaignInfluencerId,
        influencer,
        username,
      } = target;

      let channel =
        target.channel;

      const profile =
        profileMap.get(
          username.toLowerCase()
        );

      if (!profile) {
        results.push({
          campaignInfluencerId,
          influencerId:
            influencer.id,
          name:
            influencer.name,
          username,
          status: "failed",
          reason:
            "Apify 결과에서 계정을 찾지 못함",
        });
        continue;
      }

      const stats =
        calculateProfileStats(
          profile
        );

      try {
        if (!channel) {
          const existingChannels =
            channelsByInfluencer.get(
              influencer.id
            ) ?? [];

          const {
            data:
              insertedChannel,
            error:
              insertChannelError,
          } = await admin
            .from(
              "influencer_channels"
            )
            .insert({
              influencer_id:
                influencer.id,
              platform:
                "instagram",
              channel_name:
                influencer.name ||
                username,
              handle: username,
              url: `https://www.instagram.com/${username}/`,
              followers:
                stats.followers,
              avg_views:
                stats.avgViews,
              is_primary:
                existingChannels.length ===
                0,
            })
            .select(
              "id, influencer_id, platform, channel_name, handle, url, followers, avg_views, is_primary"
            )
            .single();

          if (
            insertChannelError ||
            !insertedChannel
          ) {
            throw new Error(
              insertChannelError?.message ||
                "Instagram 채널 생성 실패"
            );
          }

          channel =
            insertedChannel as ChannelRow;
        }

        const channelPatch:
          Record<
            string,
            unknown
          > = {
            handle: username,
            url: `https://www.instagram.com/${username}/`,
            stats_updated_at:
              new Date().toISOString(),
            stats_source:
              "apify_instagram_profile",
          };

        if (
          stats.followers !==
          null
        ) {
          channelPatch.followers =
            stats.followers;
        }

        if (
          stats.avgViews !==
          null
        ) {
          channelPatch.avg_views =
            stats.avgViews;
        }

        /*
         * 게시물 데이터 자체가 반환된 경우에만 광고 평균을 새 값으로 갱신합니다.
         * 게시물이 하나도 반환되지 않은 경우 기존 광고 평균값은 보존합니다.
         */
        if (
          stats.postsReturned >
          0
        ) {
          channelPatch.ad_avg_views =
            stats.adAvgViews;
          channelPatch.ad_posts_sampled =
            stats.adPostsSampled;
        }

        const {
          error:
            channelUpdateError,
        } = await admin
          .from(
            "influencer_channels"
          )
          .update(
            channelPatch
          )
          .eq(
            "id",
            channel.id
          );

        if (
          channelUpdateError
        ) {
          throw new Error(
            channelUpdateError.message
          );
        }

        const influencerPatch:
          Record<
            string,
            unknown
          > = {
            instagram_id:
              username,
            instagram_url:
              `https://www.instagram.com/${username}/`,
          };

        /*
         * 기존 CRM의 followers/avg_views는 대표 채널의 legacy mirror이므로
         * Instagram이 대표 채널일 때만 해당 값을 덮어씁니다.
         */
        if (
          channel.is_primary
        ) {
          if (
            stats.followers !==
            null
          ) {
            influencerPatch.followers =
              stats.followers;
          }

          if (
            stats.avgViews !==
            null
          ) {
            influencerPatch.avg_views =
              stats.avgViews;
          }
        }

        const {
          error:
            influencerUpdateError,
        } = await admin
          .from("influencers")
          .update(
            influencerPatch
          )
          .eq(
            "id",
            influencer.id
          );

        if (
          influencerUpdateError
        ) {
          throw new Error(
            influencerUpdateError.message
          );
        }

        results.push({
          campaignInfluencerId,
          influencerId:
            influencer.id,
          name:
            influencer.name,
          username,
          status: "updated",
          beforeFollowers:
            channel.followers ??
            influencer.followers,
          followers:
            stats.followers,
          avgViews:
            stats.avgViews,
          adAvgViews:
            stats.postsReturned >
            0
              ? stats.adAvgViews
              : null,
          adPostsSampled:
            stats.adPostsSampled,
        });
      } catch (error) {
        results.push({
          campaignInfluencerId,
          influencerId:
            influencer.id,
          name:
            influencer.name,
          username,
          status: "failed",
          reason:
            error instanceof Error
              ? error.message
              : "DB 업데이트 실패",
        });
      }
    }

    const updated =
      results.filter(
        (item) =>
          item.status ===
          "updated"
      ).length;

    const skipped =
      results.filter(
        (item) =>
          item.status ===
          "skipped"
      ).length;

    const failed =
      results.filter(
        (item) =>
          item.status ===
          "failed"
      ).length;

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      failed,
      results,
    });
  } catch (error) {
    console.error(
      "refresh influencer stats error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        code:
          "STATS_REFRESH_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "인플루언서 데이터 최신화 중 오류가 발생했습니다.",
        results: [],
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      { status: 500 }
    );
  }
}
