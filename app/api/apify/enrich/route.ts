import { NextResponse } from "next/server";

const PROFILE_ACTOR_ID =
  "dami_studio~instagram-profile-scraper";

type Candidate = {
  username: string;
  profileUrl?: string;

  source?: string;
  discoverySources?: string[];

  sourceSeed?: string;
  sourceHashtags?: string[];

  referenceHits?: string[];
  referenceOverlapCount?: number;
  referenceOverlapRatio?: number;
  graphSimilarity?: number;

  hashtagDiscoveryPosts?: number;
  hashtagAdPosts?: number;
  hashtagAdRatio?: number;
  hashtagAdTags?: string[];
  hashtagLatestTimestamp?: string;
};

function cleanUsername(value: unknown) {
  if (!value) return "";

  return String(value)
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .split("?")[0]
    .replace(/^\/+|\/+$/g, "");
}

function mergeCandidates(
  related: Candidate[],
  hashtag: Candidate[]
) {
  const map = new Map<string, Candidate>();

  function add(candidate: Candidate, source: string) {
    const username =
      cleanUsername(candidate.username);

    if (!username) return;

    const key = username.toLowerCase();

    const incomingSources =
      candidate.discoverySources?.length
        ? candidate.discoverySources
        : [source];

    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...candidate,

        username,

        profileUrl:
          candidate.profileUrl ||
          `https://www.instagram.com/${username}/`,

        source,

        discoverySources:
          Array.from(
            new Set(incomingSources)
          ),

        sourceHashtags:
          candidate.sourceHashtags || [],

        referenceHits:
          candidate.referenceHits || [],
      });

      return;
    }

    existing.discoverySources =
      Array.from(
        new Set([
          ...(existing.discoverySources || []),
          ...incomingSources,
        ])
      );

    existing.sourceHashtags =
      Array.from(
        new Set([
          ...(existing.sourceHashtags || []),
          ...(candidate.sourceHashtags || []),
        ])
      );

    existing.referenceHits =
      Array.from(
        new Set([
          ...(existing.referenceHits || []),
          ...(candidate.referenceHits || []),
        ])
      );

    existing.hashtagDiscoveryPosts =
      Math.max(
        existing.hashtagDiscoveryPosts || 0,
        candidate.hashtagDiscoveryPosts || 0
      );

    existing.hashtagAdPosts =
      Math.max(
        existing.hashtagAdPosts || 0,
        candidate.hashtagAdPosts || 0
      );

    existing.hashtagAdRatio =
      Math.max(
        existing.hashtagAdRatio || 0,
        candidate.hashtagAdRatio || 0
      );

    existing.hashtagAdTags =
      Array.from(
        new Set([
          ...(existing.hashtagAdTags || []),
          ...(candidate.hashtagAdTags || []),
        ])
      );

    existing.hashtagLatestTimestamp =
      [
        existing.hashtagLatestTimestamp || "",
        candidate.hashtagLatestTimestamp || "",
      ].sort().reverse()[0];

    existing.referenceOverlapCount =
      Math.max(
        existing.referenceOverlapCount || 0,
        candidate.referenceOverlapCount || 0,
        existing.referenceHits.length
      );

    existing.referenceOverlapRatio =
      Math.max(
        existing.referenceOverlapRatio || 0,
        candidate.referenceOverlapRatio || 0
      );

    existing.graphSimilarity =
      Math.max(
        existing.graphSimilarity || 0,
        candidate.graphSimilarity || 0
      );

    // Related source를 우선 대표 source로 유지
    if (
      source === "seed_related" ||
      source === "seed_related_fallback"
    ) {
      existing.source = source;

      if (candidate.sourceSeed) {
        existing.sourceSeed =
          candidate.sourceSeed;
      }
    }
  }

  for (const candidate of related || []) {
    add(
      candidate,
      candidate.source || "seed_related"
    );
  }

  for (const candidate of hashtag || []) {
    add(
      candidate,
      candidate.source || "hashtag"
    );
  }

  return Array.from(map.values());
}

async function scrapeProfiles(
  token: string,
  usernames: string[]
) {
  if (!usernames.length) {
    return [];
  }

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${PROFILE_ACTOR_ID}/runs?token=${encodeURIComponent(
      token
    )}&waitForFinish=120`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usernames,
        includeLatestPosts: true,
      }),
      cache: "no-store",
    }
  );

  const runData = await runResponse.json();

  if (!runResponse.ok) {
    console.error(
      "Profile enrichment actor error:",
      runData
    );

    throw new Error(
      "Profile Scraper 실행 실패"
    );
  }

  const datasetId =
    runData?.data?.defaultDatasetId;

  if (!datasetId) {
    throw new Error(
      "Profile Dataset ID 없음"
    );
  }

  const datasetResponse = await fetch(
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
      "Profile 결과 조회 실패"
    );
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = String(
      body.apifyToken || ""
    ).trim();

    const relatedCandidates =
      Array.isArray(body.relatedCandidates)
        ? body.relatedCandidates
        : [];

    const hashtagCandidates =
      Array.isArray(body.hashtagCandidates)
        ? body.hashtagCandidates
        : [];

    const seedAccounts: string[] =
        Array.isArray(body.seedAccounts)
            ? body.seedAccounts
                .map((value: unknown) => cleanUsername(value))
                .filter((value: string) => value.length > 0)
            : [];

    const minFollowers = Math.max(
      0,
      Number(body.minFollowers || 0)
    );

    const maxFollowers = Math.max(
      minFollowers,
      Number(
        body.maxFollowers ||
          Number.MAX_SAFE_INTEGER
      )
    );

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apify API Key가 없습니다.",
        },
        { status: 400 }
      );
    }

    const merged = mergeCandidates(
      relatedCandidates,
      hashtagCandidates
    );

    const seedSet = new Set(
      seedAccounts.map((x) =>
        x.toLowerCase()
      )
    );

    const candidatesWithoutSeeds =
      merged.filter(
        (candidate) =>
          !seedSet.has(
            candidate.username.toLowerCase()
          )
      );

    const usernames =
      candidatesWithoutSeeds.map(
        (candidate) =>
          candidate.username
      );

    const profiles =
      await scrapeProfiles(
        token,
        usernames
      );

    const profileMap =
      new Map<string, any>();

    for (const item of profiles) {
      const username =
        cleanUsername(
          item.username ||
            item.userName
        );

      if (!username) continue;

      profileMap.set(
        username.toLowerCase(),
        item
      );
    }

    const enriched =
      candidatesWithoutSeeds.map(
        (candidate) => {
          const profile =
            profileMap.get(
              candidate.username.toLowerCase()
            );

          const followersRaw =
            profile?.followersCount ??
            profile?.followers ??
            null;

          const followers =
            followersRaw != null &&
            Number.isFinite(
              Number(followersRaw)
            )
              ? Number(followersRaw)
              : null;

          const followerInRange =
            followers != null &&
            followers >= minFollowers &&
            followers <= maxFollowers;

          return {
            ...candidate,

            displayName:
              profile?.fullName ??
              profile?.full_name ??
              "",

            followers,

            followerInRange,

            biography:
              profile?.biography ??
              profile?.bio ??
              "",

            profilePicUrl:
              profile?.profilePicUrl ??
              profile?.profilePicUrlHD ??
              "",

            instagramUrl:
              profile?.url ??
              candidate.profileUrl ??
              `https://www.instagram.com/${candidate.username}/`,

            isVerified:
              Boolean(
                profile?.verified ??
                  profile?.isVerified
              ),

            postsCount:
              profile?.postsCount ??
              profile?.posts ??
              null,
          };
        }
      );

    const eligible =
      enriched.filter(
        (candidate) =>
          candidate.followerInRange
      );

    // 일단 1차 정렬:
    // related + hashtag 둘 다 발견된 후보 우선
    // 그다음 graph similarity
    // 그다음 hashtag 발견 게시물 수
    eligible.sort((a, b) => {
      const aBoth =
        (a.discoverySources || [])
          .length > 1
          ? 1
          : 0;

      const bBoth =
        (b.discoverySources || [])
          .length > 1
          ? 1
          : 0;

      if (aBoth !== bBoth) {
        return bBoth - aBoth;
      }

      const graphDiff =
        (b.graphSimilarity || 0) -
        (a.graphSimilarity || 0);

      if (graphDiff !== 0) {
        return graphDiff;
      }

      return (
        (b.hashtagDiscoveryPosts || 0) -
        (a.hashtagDiscoveryPosts || 0)
      );
    });

    return NextResponse.json({
      ok: true,

      stats: {
        relatedInput:
          relatedCandidates.length,

        hashtagInput:
          hashtagCandidates.length,

        merged:
          merged.length,

        afterSeedExclusion:
          candidatesWithoutSeeds.length,

        profilesFound:
          profileMap.size,

        followerFit:
          eligible.length,

        minFollowers,
        maxFollowers,
      },

      candidates: eligible,

      allEnriched: enriched,
    });
  } catch (error) {
    console.error(
      "Enrichment error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "후보 Profile 조회 및 필터링 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}