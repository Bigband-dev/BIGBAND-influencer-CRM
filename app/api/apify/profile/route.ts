import { NextResponse } from "next/server";

const PROFILE_ACTOR_ID = "dami_studio~instagram-profile-scraper";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = String(body.apifyToken || "").trim();

    const username = String(body.username || "")
      .trim()
      .replace(/^@/, "");

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "Apify API Key가 없습니다.",
        },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        {
          ok: false,
          message: "Instagram 계정을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    // Actor 실행
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
          usernames: [username],
          includeLatestPosts: true,
        }),
        cache: "no-store",
      }
    );

    const runData = await runResponse.json();

    if (!runResponse.ok) {
      console.error("Apify run error:", runData);

      return NextResponse.json(
        {
          ok: false,
          message: "Instagram Profile Scraper 실행에 실패했습니다.",
          detail: runData,
        },
        { status: 500 }
      );
    }

    const datasetId = runData?.data?.defaultDatasetId;

    if (!datasetId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Apify Dataset ID를 찾을 수 없습니다.",
        },
        { status: 500 }
      );
    }

    // Dataset 결과 조회
    const datasetResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(
        token
      )}&clean=true`,
      {
        cache: "no-store",
      }
    );

    const items = await datasetResponse.json();

    if (!datasetResponse.ok) {
      console.error("Dataset error:", items);

      return NextResponse.json(
        {
          ok: false,
          message: "Profile 결과를 가져오지 못했습니다.",
        },
        { status: 500 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Instagram 계정을 찾지 못했습니다.",
        },
        { status: 404 }
      );
    }

    const item = items[0];

    return NextResponse.json({
      ok: true,

      profile: {
        username: item.username ?? username,

        fullName:
          item.fullName ??
          item.full_name ??
          "",

        biography:
          item.biography ??
          item.bio ??
          "",

        followers:
          item.followersCount ??
          item.followers ??
          null,

        following:
          item.followsCount ??
          item.following ??
          null,

        posts:
          item.postsCount ??
          item.posts ??
          null,

        profilePicUrl:
          item.profilePicUrl ??
          item.profilePicUrlHD ??
          "",

        instagramUrl:
          item.url ??
          `https://www.instagram.com/${username}/`,
      },

      raw: item,
    });
  } catch (error) {
    console.error("Profile API error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Instagram Profile 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}