import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

import { createClient } from "@/lib/supabase/server";
import {
  createGoogleOAuthClient,
} from "@/lib/google/oauth";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  const code =
    request.nextUrl.searchParams.get("code");

  const oauthError =
    request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/account?gmail_error=${encodeURIComponent(
          oauthError
        )}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/account?gmail_error=missing_code",
        request.url
      )
    );
  }

  try {
    const oauth2Client =
      createGoogleOAuthClient();

    /*
     * Google authorization code →
     * access token / refresh token 교환
     */
    const { tokens } =
      await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    /*
     * 현재 연결한 Google 계정 이메일 확인
     */
    const oauth2 = google.oauth2({
      version: "v2",
      auth: oauth2Client,
    });

    const { data: googleUser } =
      await oauth2.userinfo.get();

    const googleEmail =
      googleUser.email;

    if (!googleEmail) {
      throw new Error(
        "Google 계정 이메일을 확인할 수 없습니다."
      );
    }

    /*
     * 기존 Gmail 연결이 있는지 확인
     */
    const admin =
      createAdminClient();

    const {
      data: existingConnection,
      error: existingError,
    } = await admin
      .from("gmail_connections")
      .select("id, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `기존 Gmail 연결 조회 실패: ${existingError.message}`
      );
    }

    /*
     * Google은 재인증 상황에 따라
     * refresh_token을 매번 반환하지 않을 수 있으므로
     * 기존 refresh_token이 있으면 유지합니다.
     */
    const refreshToken =
      tokens.refresh_token ??
      existingConnection?.refresh_token ??
      null;

    if (!refreshToken) {
      throw new Error(
        "Refresh Token을 받지 못했습니다. Gmail 연결을 다시 시도해주세요."
      );
    }

    const tokenExpiresAt =
      tokens.expiry_date
        ? new Date(
            tokens.expiry_date
          ).toISOString()
        : null;

    const scopes =
      tokens.scope
        ? tokens.scope
            .split(" ")
            .filter(Boolean)
        : [];

    const connection = {
      user_id: user.id,

      google_email:
        googleEmail,

      access_token:
        tokens.access_token ??
        null,

      refresh_token:
        refreshToken,

      token_expires_at:
        tokenExpiresAt,

      scopes,

      updated_at:
        new Date().toISOString(),
    };

    const { error: saveError } =
      await admin
        .from("gmail_connections")
        .upsert(
          {
            user_id: user.id,

            google_email:
              googleEmail,

            access_token:
              tokens.access_token ?? null,

            refresh_token:
              refreshToken,

            token_expires_at:
              tokenExpiresAt,

            scopes,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

    if (saveError) {
      throw new Error(
        `Gmail 연결 저장 실패: ${saveError.message}`
      );
    }

    return NextResponse.redirect(
      new URL(
        "/account?gmail_connected=1",
        request.url
      )
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gmail 연결 중 오류가 발생했습니다.";

    console.error(
      "Google OAuth callback error:",
      error
    );

    return NextResponse.redirect(
      new URL(
        `/account?gmail_error=${encodeURIComponent(
          message
        )}`,
        request.url
      )
    );
  }
}