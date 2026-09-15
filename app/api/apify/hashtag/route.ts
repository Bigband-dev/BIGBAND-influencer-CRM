import { NextResponse } from "next/server";

const HASHTAG_ACTOR_ID =
  "dami_studio~instagram-hashtag-scraper";

function cleanTag(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^#/, "")
    .trim();
}

function extractHashtags(caption: string) {
  const matches =
    caption.matchAll(/(?<!\w)#([0-9A-Za-z_가-힣]+)/g);

  return Array.from(matches)
    .map((match) => match[1]?.toLowerCase())
    .filter(Boolean);
}

function itemHashtags(
  item: Record<string, any>,
  caption: string
) {
  const tags = new Set<string>();

  const raw = item.hashtags;

  if (typeof raw === "string") {
    raw
      .split(/[,\s]+/)
      .map(cleanTag)
      .filter(Boolean)
      .forEach((tag) =>
        tags.add(tag.toLowerCase())
      );
  }

  if (Array.isArray(raw)) {
    raw
      .map(cleanTag)
      .filter(Boolean)
      .forEach((tag) =>
        tags.add(tag.toLowerCase())
      );
  }

  for (const tag of extractHashtags(caption)) {
    tags.add(tag);
  }

  return tags;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = String(
      body.apifyToken || ""
    ).trim();

    const hashtags = Array.from(
      new Set(
        (Array.isArray(body.hashtags)
          ? body.hashtags
          : []
        )
          .map(cleanTag)
          .filter(Boolean)
      )
    );

    const resultsLimit = Math.max(
      1,
      Number(body.resultsLimit || 50)
    );

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "Apify API Key가 없습니다.",
        },
        { status: 400 }
      );
    }

    if (!hashtags.length) {
      return NextResponse.json(
        {
          ok: false,
          message: "검색 해시태그가 없습니다.",
        },
        { status: 400 }
      );
    }

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${HASHTAG_ACTOR_ID}/runs?token=${encodeURIComponent(
        token
      )}&waitForFinish=120`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hashtags,
          resultsLimit,
        }),
        cache: "no-store",
      }
    );

    const runData = await runResponse.json();

    if (!runResponse.ok) {
      console.error(
        "Hashtag actor error:",
        runData
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "Instagram Hashtag Scraper 실행에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    const datasetId =
      runData?.data?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Dataset ID를 찾을 수 없습니다.",
        },
        { status: 500 }
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
      return NextResponse.json(
        {
          ok: false,
          message:
            "Hashtag 검색 결과를 가져오지 못했습니다.",
        },
        { status: 500 }
      );
    }

    const adSignalTags = new Set([
      "광고",
      "협찬",
      "제품제공",
      "유료광고",
    ]);

    const candidateMap = new Map<
      string,
      {
        username: string;
        profileUrl: string;
        source: string;
        sourceHashtags: Set<string>;
        posts: number;
        adPosts: number;
        adTags: Set<string>;
        latestTimestamp: string;
      }
    >();

    let datasetRows = 0;
    let usableMediaRows = 0;
    let adMediaRows = 0;

    for (const item of items) {
      datasetRows += 1;

      if (
        item?._sample ||
        item?.error ||
        item?.errorCode
      ) {
        continue;
      }

      const username = String(
        item.ownerUsername ??
          item.owner_username ??
          item.username ??
          ""
      )
        .trim()
        .replace(/^@/, "");

      if (!username) continue;

      usableMediaRows += 1;

      const sourceTag = cleanTag(
        item.hashtag ??
          item.hashtag_scrape ??
          item.inputHashtag
      );

      const caption = String(
        item.caption || ""
      );

      const allTags = itemHashtags(
        item,
        caption
      );

      const matchedAdTags = Array.from(
        allTags
      ).filter((tag) =>
        adSignalTags.has(tag)
      );

      const isSponsored = Boolean(
        item.isSponsored ||
          item.isPaidPartnership ||
          item.is_paid_partnership
      );

      const key = username.toLowerCase();

      let candidate =
        candidateMap.get(key);

      if (!candidate) {
        candidate = {
          username,
          profileUrl:
            `https://www.instagram.com/${username}/`,
          source: "hashtag",
          sourceHashtags:
            new Set<string>(),
          posts: 0,
          adPosts: 0,
          adTags:
            new Set<string>(),
          latestTimestamp: "",
        };

        candidateMap.set(
          key,
          candidate
        );
      }

      if (sourceTag) {
        candidate.sourceHashtags.add(
          sourceTag
        );
      }

      candidate.posts += 1;

      if (
        matchedAdTags.length ||
        isSponsored
      ) {
        candidate.adPosts += 1;
        adMediaRows += 1;
      }

      for (const tag of matchedAdTags) {
        candidate.adTags.add(tag);
      }

      const timestamp = String(
        item.timestamp || ""
      );

      if (
        timestamp &&
        timestamp >
          candidate.latestTimestamp
      ) {
        candidate.latestTimestamp =
          timestamp;
      }
    }

    const candidates = Array.from(
      candidateMap.values()
    ).map((candidate) => ({
      username: candidate.username,
      profileUrl:
        candidate.profileUrl,
      source: candidate.source,

      sourceHashtags:
        Array.from(
          candidate.sourceHashtags
        ).sort(),

      hashtagDiscoveryPosts:
        candidate.posts,

      hashtagAdPosts:
        candidate.adPosts,

      hashtagAdRatio:
        candidate.posts > 0
          ? candidate.adPosts /
            candidate.posts
          : 0,

      hashtagAdTags:
        Array.from(
          candidate.adTags
        ).sort(),

      hashtagLatestTimestamp:
        candidate.latestTimestamp,
    }));

    return NextResponse.json({
      ok: true,

      stats: {
        datasetRows,
        usableMediaRows,
        adMediaRows,
        uniqueCreators:
          candidates.length,
      },

      candidates,
    });
  } catch (error) {
    console.error(
      "Hashtag discovery error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Hashtag 검색 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}