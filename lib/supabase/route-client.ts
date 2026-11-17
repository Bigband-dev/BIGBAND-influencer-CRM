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
        // URI 인코딩된 값이 아니면 원문을 그대로 사용합니다.
      }

      return {
        name,
        value,
      };
    })
    .filter(
      (cookie) => cookie.name.length > 0
    );
}

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
          // OAuth GET에서 이미 request context를 확정한 뒤 사용하는 read-only client입니다.
        },
      },
    }
  );
}

export function createRouteSupabaseClient(
  request: NextRequest
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
    );
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
          // POST API 인증 확인용 read-only client입니다.
        },
      },
    }
  );
}
