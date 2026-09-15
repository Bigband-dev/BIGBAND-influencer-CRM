import { NextResponse } from "next/server";

const PROFILE_ACTOR_ID = "dami_studio~instagram-profile-scraper";

function cleanUsername(value: unknown) {
  if (!value) return null;

  let username = String(value).trim().replace(/^@/, "");

  if (username.startsWith("http")) {
    try {
      const url = new URL(username);
      const parts = url.pathname.split("/").filter(Boolean);
      username = parts[0] || "";
    } catch {
      return null;
    }
  }

  username = username.split("?")[0].replace(/^\/+|\/+$/g, "");

  return username || null;
}

function collectRelated(value: unknown, out: string[]) {
  if (!value) return;

  if (typeof value === "string") {
    const username = cleanUsername(value);
    if (username) out.push(username);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectRelated(item, out);
    }
    return;
  }

  if (typeof value !== "object") return;

  const obj = value as Record<string, any>;

  const username =
    obj.username ||
    obj.userName ||
    obj.handle;

  if (username) {
    const cleaned = cleanUsername(username);
    if (cleaned) out.push(cleaned);
  }

  for (const key of [
    "node",
    "user",
    "profile",
    "edges",
    "items",
    "nodes",
    "results",
  ]) {
    if (obj[key]) {
      collectRelated(obj[key], out);
    }
  }
}

function parseRelatedProfiles(profile: Record<string, any>) {
  const relatedValues: unknown[] = [];

  const knownKeys = [
    "relatedProfiles",
    "related_profiles",
    "relatedprofiles",
    "suggestedProfiles",
    "suggested_profiles",
    "similarProfiles",
    "similar_profiles",
  ];

  for (const key of knownKeys) {
    if (profile[key] != null) {
      relatedValues.push(profile[key]);
    }
  }

  for (const [key, value] of Object.entries(profile)) {
    const lower = key.toLowerCase();

    if (knownKeys.includes(key)) continue;

    if (
      ["related", "suggested", "similar"].some((x) =>
        lower.includes(x)
      ) &&
      ["profile", "user", "account", "edge"].some((x) =>
        lower.includes(x)
      )
    ) {
      relatedValues.push(value);
    }
  }

  const out: string[] = [];

  for (const value of relatedValues) {
    collectRelated(value, out);
  }

  const selfUsername = String(
    profile.username || ""
  ).toLowerCase();

  const seen = new Set<string>();

  return out.filter((username) => {
    const key = username.toLowerCase();

    if (!username) return false;
    if (key === selfUsername) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

async function runProfileScraper(
  token: string,
  usernames: string[]
) {
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
    throw new Error("Profile Scraper 실행 실패");
  }

  const datasetId =
    runData?.data?.defaultDatasetId;

  if (!datasetId) {
    throw new Error("Dataset ID 없음");
  }

  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(
      token
    )}&clean=true`,
    {
      cache: "no-store",
    }
  );

  const items = await datasetResponse.json();

  if (!datasetResponse.ok || !Array.isArray(items)) {
    throw new Error("Profile 결과 조회 실패");
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = String(
      body.apifyToken || ""
    ).trim();

    const rawSeeds = Array.isArray(body.seedAccounts)
      ? body.seedAccounts
      : [];

    const seeds = Array.from(
      new Set(
        rawSeeds
          .map(cleanUsername)
          .filter(Boolean)
          .map((x) => String(x))
      )
    );

    const maxRelatedPerProfile = Math.max(
      1,
      Number(body.maxRelatedPerProfile || 20)
    );

    const maxCandidates = Math.max(
      1,
      Number(body.maxCandidates || 30)
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

    if (!seeds.length) {
      return NextResponse.json(
        {
          ok: false,
          message: "레퍼런스 계정이 없습니다.",
        },
        { status: 400 }
      );
    }

    const profiles = await runProfileScraper(
      token,
      seeds
    );

    const seedSet = new Set(
      seeds.map((x) => x.toLowerCase())
    );

    const candidateMap = new Map<
      string,
      {
        username: string;
        profileUrl: string;
        source: string;
        sourceSeed: string;
        discoveryDepth: number;
        referenceHits: string[];
        referenceOverlapCount: number;
        referenceOverlapRatio: number;
        graphSimilarity: number;
      }
    >();

    for (const profile of profiles) {
      const parentUsername = String(
        profile.username || ""
      ).trim();

      if (!parentUsername) continue;

      const related = parseRelatedProfiles(
        profile
      ).slice(0, maxRelatedPerProfile);

      for (const username of related) {
        const key = username.toLowerCase();

        if (seedSet.has(key)) continue;

        const existing = candidateMap.get(key);

        if (!existing) {
          candidateMap.set(key, {
            username,
            profileUrl:
              `https://www.instagram.com/${username}/`,
            source: "seed_related",
            sourceSeed: parentUsername,
            discoveryDepth: 1,
            referenceHits: [parentUsername],
            referenceOverlapCount: 1,
            referenceOverlapRatio: 0,
            graphSimilarity: 0,
          });
        } else {
          existing.referenceHits = Array.from(
            new Set([
              ...existing.referenceHits,
              parentUsername,
            ])
          );
        }

        if (candidateMap.size >= maxCandidates) {
          break;
        }
      }

      if (candidateMap.size >= maxCandidates) {
        break;
      }
    }

    const totalRefs = Math.max(
      seeds.length,
      1
    );

    const candidates = Array.from(
      candidateMap.values()
    ).map((candidate) => {
      const referenceOverlapCount =
        candidate.referenceHits.length;

      const referenceOverlapRatio =
        referenceOverlapCount / totalRefs;

      const graphSimilarity = Math.min(
        1,
        referenceOverlapRatio
      );

      return {
        ...candidate,
        referenceOverlapCount,
        referenceOverlapRatio,
        graphSimilarity,
      };
    });

    return NextResponse.json({
      ok: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error(
      "Related discovery error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "Related 계정 검색 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}