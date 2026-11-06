import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

// 이 라우트는 Supabase 세션 쿠키를 읽으므로 빌드 시 정적 평가하면 안 됩니다.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sanitizeReturnTo(value: string | null) {
  if (!value) return "/account";

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
