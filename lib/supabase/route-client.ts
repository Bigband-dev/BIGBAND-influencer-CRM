import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

function getSupabasePublicKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다."
    );
  }

  return key;
}

type CookieSnapshot = {
  name: string;
  value: string;
};

export function parseCookieHeader(
  cookieHeader: string | null
): CookieSnapshot[] {
  if (!cookieHeader?.trim()) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex < 0) {
        return {
          name: part,
          value: "",
        };
      }

      const name = part
        .slice(0, separatorIndex)
        .trim();

      const rawValue = part
        .slice(separatorIndex + 1)
        .trim();

      let value = rawValue;

      try {
        value = decodeURIComponent(rawValue);
      } catch {
        // 이미 일반 문자열이면 그대로 사용합니다.
      }

      return {
        name,
        value,
      };
    })
    .filter((cookie) => cookie.name.length > 0);
}

/**
 * OAuth GET Route Handler용.
 *
 * await connection() 이후 request.headers에서 Cookie 헤더를 한 번 읽고
 * 이 함수에는 일반 문자열만 전달합니다.
 * Supabase 내부에서 NextRequest.cookies를 나중에 다시 읽지 않도록 하는 것이 핵심입니다.
 */
export function createRouteSupabaseClientFromCookieHeader(
  cookieHeader: string | null
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
    );
  }

  const cookieSnapshot =
    parseCookieHeader(cookieHeader);

  return createServerClient(
    supabaseUrl,
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieSnapshot;
        },
        setAll() {
          // OAuth start/callback에서는 기존 로그인 세션 조회만 합니다.
        },
      },
    }
  );
}

/**
 * POST Route Handler 등 기존 코드 호환용.
 *
 * GET Route Handler에서는 이 함수를 직접 쓰지 말고
 * await connection() 후 createRouteSupabaseClientFromCookieHeader()를 사용하세요.
 */
export function createRouteSupabaseClient(
  request: NextRequest
) {
  return createRouteSupabaseClientFromCookieHeader(
    request.headers.get("cookie")
  );
}
