import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";

import { getGoogleAuthUrl } from "@/lib/google/oauth";
import { createRouteSupabaseClientFromCookieHeader } from "@/lib/supabase/route-client";

function sanitizeReturnTo(value: string | null) {
  if (!value) return "/account";

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export async function GET(request: NextRequest) {
  // cacheComponents 환경에서 GET Route Handler가 build-time prerender에
  // 들어가지 않도록 실제 요청 시점까지 실행을 지연합니다.
  await connection();

  try {
    // next/headers의 cookies()를 사용하지 않고 요청 쿠키를 직접 읽습니다.
    const cookieHeader =
      request.headers.get("cookie");

    const supabase =
      createRouteSupabaseClientFromCookieHeader(
        cookieHeader
      );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      const loginUrl = new URL("/login", request.url);

      const returnTo = request.nextUrl.searchParams.get("returnTo");

      if (returnTo) {
        loginUrl.searchParams.set("next", returnTo);
      }

      return NextResponse.redirect(loginUrl);
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
