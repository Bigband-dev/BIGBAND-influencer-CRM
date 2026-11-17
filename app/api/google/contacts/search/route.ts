import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";
import { createGoogleOAuthClient } from "@/lib/google/oauth";

type ContactSuggestion = {
  name: string | null;
  email: string;
  source: "directory" | "contact";
};

type PersonLike = {
  names?: Array<{
    displayName?: string | null;
    givenName?: string | null;
    familyName?: string | null;
  }> | null;
  emailAddresses?: Array<{
    value?: string | null;
  }> | null;
};

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function personToSuggestions(
  person: PersonLike | null | undefined,
  source: ContactSuggestion["source"]
): ContactSuggestion[] {
  if (!person) return [];

  const nameObject = person.names?.[0];
  const name =
    nameObject?.displayName?.trim() ||
    [nameObject?.familyName?.trim(), nameObject?.givenName?.trim()]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    null;

  return (person.emailAddresses ?? [])
    .map((item) => item.value?.trim())
    .filter((email): email is string => Boolean(email))
    .map((email) => ({
      name,
      email,
      source,
    }));
}

function matchesQuery(
  item: ContactSuggestion,
  query: string
) {
  const q = normalize(query);

  return (
    normalize(item.name).includes(q) ||
    normalize(item.email).includes(q)
  );
}

function dedupeAndRank(
  items: ContactSuggestion[],
  query: string
) {
  const q = normalize(query);
  const seen = new Set<string>();

  return items
    .filter((item) => matchesQuery(item, query))
    .filter((item) => {
      const key = item.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === "directory" ? -1 : 1;
      }

      const score = (item: ContactSuggestion) => {
        const name = normalize(item.name);
        const email = normalize(item.email);

        if (name === q || email === q) return 0;
        if (name.startsWith(q) || email.startsWith(q)) return 1;
        return 2;
      };

      const diff = score(a) - score(b);
      if (diff !== 0) return diff;

      return (a.name || a.email).localeCompare(
        b.name || b.email,
        "ko"
      );
    })
    .slice(0, 30);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "알 수 없는 오류");
}

function isScopeError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("insufficient authentication scopes") ||
    message.includes("insufficient_permission") ||
    message.includes("insufficientpermissions") ||
    message.includes("permission denied") ||
    message.includes("forbidden")
  );
}

async function loadDirectoryPeople(
  people: ReturnType<typeof google.people>
) {
  const result: ContactSuggestion[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const response =
      await people.people.listDirectoryPeople({
        readMask: "names,emailAddresses",
        sources: [
          "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE",
          "DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT",
        ],
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });

    for (const person of response.data.people ?? []) {
      result.push(
        ...personToSuggestions(
          person as PersonLike,
          "directory"
        )
      );
    }

    pageToken =
      response.data.nextPageToken ?? undefined;

    if (!pageToken || result.length >= 5000) {
      break;
    }
  }

  return result;
}

async function loadPersonalContacts(
  people: ReturnType<typeof google.people>
) {
  const result: ContactSuggestion[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const response =
      await people.people.connections.list({
        resourceName: "people/me",
        personFields: "names,emailAddresses",
        // Google People API connections.list의 최대 pageSize는 500
        pageSize: 500,
        ...(pageToken ? { pageToken } : {}),
      });

    for (
      const person of response.data.connections ?? []
    ) {
      result.push(
        ...personToSuggestions(
          person as PersonLike,
          "contact"
        )
      );
    }

    pageToken =
      response.data.nextPageToken ?? undefined;

    if (!pageToken || result.length >= 5000) {
      break;
    }
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const supabase =
      await createRouteSupabaseClient(request);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const query =
      request.nextUrl.searchParams
        .get("q")
        ?.trim() ?? "";

    if (!query) {
      return NextResponse.json({
        success: true,
        contacts: [],
      });
    }

    const admin = createAdminClient();

    const {
      data: connection,
      error: connectionError,
    } = await admin
      .from("gmail_connections")
      .select(
        "google_email, refresh_token, scopes"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      connectionError ||
      !connection?.refresh_token
    ) {
      return NextResponse.json(
        {
          code: connectionError
            ? "GMAIL_CONNECTION_LOOKUP_FAILED"
            : "GMAIL_NOT_CONNECTED",
          error: connectionError
            ? `Gmail 연결 조회 실패: ${connectionError.message}`
            : "Gmail 계정이 연결되어 있지 않습니다.",
        },
        {
          status: connectionError ? 500 : 409,
        }
      );
    }

    const oauth2Client =
      createGoogleOAuthClient();

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
    });

    const people = google.people({
      version: "v1",
      auth: oauth2Client,
    });

    let directoryAvailable = true;
    let contactsAvailable = true;
    let directoryError: string | null = null;
    let contactsError: string | null = null;

    const [directoryResult, contactResult] =
      await Promise.all([
        loadDirectoryPeople(people).catch(
          (error) => {
            directoryError = getErrorMessage(error);

            if (isScopeError(error)) {
              directoryAvailable = false;
              return [];
            }

            // 회사 디렉터리 실패가 개인 연락처 검색까지 막지 않게 함
            return [];
          }
        ),
        loadPersonalContacts(people).catch(
          (error) => {
            contactsError = getErrorMessage(error);

            if (isScopeError(error)) {
              contactsAvailable = false;
              return [];
            }

            // 개인 연락처 실패가 회사 디렉터리 검색까지 막지 않게 함
            return [];
          }
        ),
      ]);

    const contacts = dedupeAndRank(
      [
        ...directoryResult,
        ...contactResult,
      ],
      query
    );

    return NextResponse.json({
      success: true,
      contacts,
      directoryAvailable,
      contactsAvailable,
      directoryCount: directoryResult.length,
      contactCount: contactResult.length,
      directoryError,
      contactsError,
      needsReconnect:
        !directoryAvailable ||
        !contactsAvailable,
    });
  } catch (error) {
    console.error(
      "Google directory/contact search error:",
      error
    );

    return NextResponse.json(
      {
        code: "CONTACTS_SEARCH_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Google 주소록 검색 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
