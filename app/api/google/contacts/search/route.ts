import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";
import { createGoogleOAuthClient } from "@/lib/google/oauth";

type SuggestionSource =
  | "directory"
  | "contact"
  | "other"
  | "group";

type ContactSuggestion = {
  name: string | null;
  email: string;
  source: SuggestionSource;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? "알 수 없는 오류");
}

function isScopeOrPermissionError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("insufficient authentication scopes") ||
    message.includes("insufficient_permission") ||
    message.includes("insufficientpermissions") ||
    message.includes("permission denied") ||
    message.includes("forbidden") ||
    message.includes("unauthorized")
  );
}

function personToSuggestions(
  person: PersonLike | null | undefined,
  source: SuggestionSource
): ContactSuggestion[] {
  if (!person) return [];

  const nameObject = person.names?.[0];

  const name =
    nameObject?.displayName?.trim() ||
    [
      nameObject?.familyName?.trim(),
      nameObject?.givenName?.trim(),
    ]
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

function sourcePriority(source: SuggestionSource) {
  switch (source) {
    case "group":
      return 0;
    case "directory":
      return 1;
    case "other":
      return 2;
    case "contact":
      return 3;
  }
}

function dedupeAndRank(
  items: ContactSuggestion[],
  query: string
) {
  const q = normalize(query);

  const bestByEmail = new Map<
    string,
    ContactSuggestion
  >();

  for (const item of items) {
    if (!matchesQuery(item, query)) {
      continue;
    }

    const key = item.email.toLowerCase();
    const current = bestByEmail.get(key);

    if (
      !current ||
      sourcePriority(item.source) <
        sourcePriority(current.source)
    ) {
      bestByEmail.set(key, item);
    }
  }

  return [...bestByEmail.values()]
    .sort((a, b) => {
      const aName = normalize(a.name);
      const bName = normalize(b.name);
      const aEmail = normalize(a.email);
      const bEmail = normalize(b.email);

      const matchScore = (
        name: string,
        email: string
      ) => {
        if (name === q || email === q) return 0;
        if (
          name.startsWith(q) ||
          email.startsWith(q)
        ) {
          return 1;
        }
        return 2;
      };

      const matchDifference =
        matchScore(aName, aEmail) -
        matchScore(bName, bEmail);

      if (matchDifference !== 0) {
        return matchDifference;
      }

      const sourceDifference =
        sourcePriority(a.source) -
        sourcePriority(b.source);

      if (sourceDifference !== 0) {
        return sourceDifference;
      }

      return (a.name || a.email).localeCompare(
        b.name || b.email,
        "ko"
      );
    })
    .slice(0, 40);
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

async function loadOtherContacts(
  people: ReturnType<typeof google.people>
) {
  const result: ContactSuggestion[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const response =
      await people.otherContacts.list({
        readMask: "names,emailAddresses",
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });

    for (
      const person of response.data.otherContacts ?? []
    ) {
      result.push(
        ...personToSuggestions(
          person as PersonLike,
          "other"
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

async function loadGoogleGroups(
  oauth2Client: ReturnType<
    typeof createGoogleOAuthClient
  >
) {
  const rawCustomerId =
    process.env.GOOGLE_WORKSPACE_CUSTOMER_ID?.trim();

  if (!rawCustomerId) {
    throw new Error(
      "GOOGLE_WORKSPACE_CUSTOMER_ID가 설정되지 않았습니다."
    );
  }

  const customerId = rawCustomerId.startsWith("C")
    ? rawCustomerId
    : `C${rawCustomerId}`;

  const cloudIdentity = google.cloudidentity({
    version: "v1",
    auth: oauth2Client,
  });

  const result: ContactSuggestion[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const response =
      await cloudIdentity.groups.list({
        parent: `customers/${customerId}`,
        pageSize: 1000,
        view: "BASIC",
        ...(pageToken ? { pageToken } : {}),
      });

    for (const group of response.data.groups ?? []) {
      const email =
        group.groupKey?.id?.trim() ?? "";

      if (!email) continue;

      result.push({
        name:
          group.displayName?.trim() || null,
        email,
        source: "group",
      });
    }

    pageToken =
      response.data.nextPageToken ?? undefined;

    if (!pageToken || result.length >= 5000) {
      break;
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
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

    let payload: {
      q?: unknown;
      warmup?: unknown;
    } = {};

    try {
      payload = await request.json();
    } catch {
      // 빈 body도 허용합니다.
    }

    const query =
      String(payload.q ?? "").trim();

    const warmup =
      payload.warmup === true ||
      String(payload.warmup ?? "") === "1";

    if (!query) {
      return NextResponse.json({
        success: true,
        contacts: [],
        warmup,
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

    const status = {
      directoryAvailable: true,
      contactsAvailable: true,
      otherContactsAvailable: true,
      groupsAvailable: true,
      directoryError: null as string | null,
      contactsError: null as string | null,
      otherContactsError: null as string | null,
      groupsError: null as string | null,
    };

    const [
      directoryResult,
      contactResult,
      otherContactResult,
      groupResult,
    ] = await Promise.all([
      loadDirectoryPeople(people).catch(
        (error) => {
          status.directoryError =
            getErrorMessage(error);

          if (
            isScopeOrPermissionError(error)
          ) {
            status.directoryAvailable = false;
          }

          return [];
        }
      ),
      loadPersonalContacts(people).catch(
        (error) => {
          status.contactsError =
            getErrorMessage(error);

          if (
            isScopeOrPermissionError(error)
          ) {
            status.contactsAvailable = false;
          }

          return [];
        }
      ),
      loadOtherContacts(people).catch(
        (error) => {
          status.otherContactsError =
            getErrorMessage(error);

          if (
            isScopeOrPermissionError(error)
          ) {
            status.otherContactsAvailable =
              false;
          }

          return [];
        }
      ),
      loadGoogleGroups(oauth2Client).catch(
        (error) => {
          status.groupsError =
            getErrorMessage(error);

          if (
            isScopeOrPermissionError(error)
          ) {
            status.groupsAvailable = false;
          }

          return [];
        }
      ),
    ]);

    const contacts = dedupeAndRank(
      [
        ...groupResult,
        ...directoryResult,
        ...otherContactResult,
        ...contactResult,
      ],
      query
    );

    return NextResponse.json({
      success: true,
      contacts,

      directoryCount: directoryResult.length,
      contactCount: contactResult.length,
      otherContactCount:
        otherContactResult.length,
      groupCount: groupResult.length,

      ...status,

      needsReconnect:
        !status.directoryAvailable ||
        !status.contactsAvailable ||
        !status.otherContactsAvailable ||
        !status.groupsAvailable,
    });
  } catch (error) {
    console.error(
      "Google address source search error:",
      error
    );

    return NextResponse.json(
      {
        code: "CONTACTS_SEARCH_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Google 주소 검색 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
