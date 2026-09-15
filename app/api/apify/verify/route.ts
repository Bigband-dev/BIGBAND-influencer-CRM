import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token = String(body.apifyToken || "").trim();

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          message: "Apify API Key가 없습니다.",
        },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Apify API Key가 유효하지 않습니다.",
        },
        { status: 401 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      message: "Apify 연결 성공",
      user: {
        username: data?.data?.username ?? null,
        email: data?.data?.email ?? null,
      },
    });
  } catch (error) {
    console.error("Apify verify error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Apify 연결 확인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}