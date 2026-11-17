import { createServerClient } from "@supabase/ssr";
import {
  connection,
  type NextRequest,
} from "next/server";

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

function parseCookieHeader(
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
      const separatorIndex =
        part.indexOf("=");

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
        value =
          decodeURIComponent(
            rawValue
          );
      } catch {
        // 쿠키 값이 URI 인코딩 형태가 아니면 원문을 그대로 사용합니다.
      }

      return {
        name,
        value,
      };
    })
    .filter(
      (cookie) =>
        cookie.name.length > 0
    );
}

export function createRouteSupabaseClientFromCookieHeader(
  cookieHeader: string | null
) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
    );
  }

  const cookieSnapshot =
    parseCookieHeader(
      cookieHeader
    );

  return createServerClient(
    supabaseUrl,
    getSupabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieSnapshot;
        },
        setAll() {
          /*
           * API Route에서 auth session을 새로 만드는 용도가 아닙니다.
           * 로그인 세션 검증용 읽기 전용 client로 사용합니다.
           */
        },
      },
    }
  );
}

/**
 * Route Handler용 Supabase client.
 *
 * cacheComponents가 켜진 Next.js에서는 GET Route Handler가 build-time
 * prerender 평가를 받을 수 있으므로, 이 공용 함수 자체에서 connection()
 * 을 보장합니다.
 *
 * 따라서 호출부에서는 반드시:
 *
 *   const supabase = await createRouteSupabaseClient(request);
 *
 * 로 사용해야 합니다.
 */
export async function createRouteSupabaseClient(
  request: NextRequest
) {
  await connection();

  const cookieHeader =
    request.headers.get(
      "cookie"
    );

  return createRouteSupabaseClientFromCookieHeader(
    cookieHeader
  );
}
