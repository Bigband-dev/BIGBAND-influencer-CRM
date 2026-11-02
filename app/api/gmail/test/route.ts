import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  sendGmail,
} from "@/lib/google/gmail";

export async function POST(
  request: NextRequest
) {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error:
          "로그인이 필요합니다.",
        userError:
          userError?.message ?? null,
      },
      {
        status: 401,
      }
    );
  }

  const body =
    await request.json();

  const to =
    String(
      body.to ?? ""
    ).trim();

  if (!to) {
    return NextResponse.json(
      {
        error:
          "수신자 이메일이 필요합니다.",
      },
      {
        status: 400,
      }
    );
  }

  const admin =
    createAdminClient();

  const {
    data: connection,
    error: connectionError,
  } =
    await admin
      .from("gmail_connections")
      .select(
        `
        id,
        user_id,
        google_email,
        refresh_token
        `
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  console.log(
    "CURRENT SUPABASE USER:",
    user.id,
    user.email
  );

  console.log(
    "GMAIL CONNECTION:",
    connection
  );

  console.log(
    "GMAIL CONNECTION ERROR:",
    connectionError
  );

  if (
    connectionError ||
    !connection
  ) {
    return NextResponse.json(
      {
        error:
          "연결된 Gmail 계정이 없습니다.",

        currentUserId:
          user.id,

        currentUserEmail:
          user.email,

        connection:
          connection ?? null,

        dbError:
          connectionError?.message ??
          null,
      },
      {
        status: 400,
      }
    );
  }

  if (
    !connection.refresh_token
  ) {
    return NextResponse.json(
      {
        error:
          "Gmail Refresh Token이 없습니다.",

        currentUserId:
          user.id,

        googleEmail:
          connection.google_email,
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result =
      await sendGmail({
        refreshToken:
          connection.refresh_token,

        to,

        subject:
          "[CRM 테스트] Gmail 연결 확인",

        body:
          "인플루언서 CRM Gmail API 테스트 메일입니다.",
      });

    return NextResponse.json({
      success: true,

      sender:
        connection.google_email,

      ...result,
    });
  } catch (error) {
    console.error(
      "Gmail test send error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "메일 발송 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}