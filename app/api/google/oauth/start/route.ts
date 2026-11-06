import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

function sanitizeReturnTo(value: string | null) {
  if (!value) return "/account";

  // 외부 URL로의 오픈 리다이렉트 방지
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const returnTo = sanitizeReturnTo(
      request.nextUrl.searchParams.get("returnTo")
    );

    const authUrl = getGoogleAuthUrl(returnTo);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google OAuth start error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Google OAuth 시작 중 오류가 발생했습니다.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
