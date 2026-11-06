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

/**
 * Route Handler 전용 Supabase client.
 *
 * cacheComponents 환경에서 next/headers의 cookies()를 호출하지 않고
 * NextRequest에 이미 포함된 쿠키를 직접 사용합니다.
 *
 * OAuth start/callback에서는 세션 조회만 필요하므로 setAll은 비워둡니다.
 */
export function createRouteSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.");
  }

  return createServerClient(
    supabaseUrl,
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // 이 OAuth 라우트에서는 Supabase 세션을 새로 만드는 작업을 하지 않습니다.
          // 기존 로그인 세션 확인용으로만 사용합니다.
        },
      },
    }
  );
}
