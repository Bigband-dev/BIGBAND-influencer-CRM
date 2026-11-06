import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google/oauth";

// OAuth callback도 로그인 세션 쿠키를 읽고 Google API를 사용하므로
// 반드시 요청 시점에 Node.js 런타임에서 실행합니다.
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
    const code = request.nextUrl.searchParams.get("code");
    const oauthError = request.nextUrl.searchParams.get("error");
    const state = request.nextUrl.searchParams.get("state");

    if (oauthError) {
      const errorUrl = new URL("/account", request.url);
      errorUrl.searchParams.set("gmail_error", oauthError);
      return NextResponse.redirect(errorUrl);
    }

    if (!code) {
      return NextResponse.json(
        { error: "Google OAuth authorization code가 없습니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const oauth2Client = createGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    const { data: googleUser } =
      await oauth2.userinfo.get();

    const googleEmail = googleUser.email?.trim();

    if (!googleEmail) {
      throw new Error(
        "Google 계정 이메일을 확인할 수 없습니다."
      );
    }

    const admin = createAdminClient();

    const {
      data: existing,
      error: existingError,
    } = await admin
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `기존 Gmail 연결 조회 실패: ${existingError.message}`
      );
    }

    const refreshToken =
      tokens.refresh_token ??
      existing?.refresh_token ??
      null;

    if (!refreshToken) {
      throw new Error(
        "Google refresh token을 받지 못했습니다. Google 계정에서 기존 앱 권한을 제거한 뒤 다시 연결해주세요."
      );
    }

    const expiresAt =
      tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null;

    const scopes =
      typeof tokens.scope === "string"
        ? tokens.scope.split(" ").filter(Boolean)
        : [];

    const { error: upsertError } = await admin
      .from("gmail_connections")
      .upsert(
        {
          user_id: user.id,
          google_email: googleEmail,
          refresh_token: refreshToken,
          access_token: tokens.access_token ?? null,
          token_expires_at: expiresAt,
          scopes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (upsertError) {
      throw new Error(
        `Gmail 연결 저장 실패: ${upsertError.message}`
      );
    }

    const returnTo = sanitizeReturnTo(state);
    const destination = new URL(returnTo, request.url);
    destination.searchParams.set("gmail_connected", "1");

    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("Google OAuth callback error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Google OAuth 처리 중 오류가 발생했습니다.";

    const errorUrl = new URL("/account", request.url);
    errorUrl.searchParams.set("gmail_error", message);

    return NextResponse.redirect(errorUrl);
  }
}
