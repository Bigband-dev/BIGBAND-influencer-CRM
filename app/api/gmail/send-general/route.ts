import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteSupabaseClient } from "@/lib/supabase/route-client";
import {
  getGmailSignature,
  sendGmail,
} from "@/lib/google/gmail";

type RequestedRecipient = {
  name?: string | null;
  email?: string | null;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}

function parseEmailList(
  value: unknown
) {
  const source = Array.isArray(
    value
  )
    ? value
    : String(value ?? "").split(
        /[;,\n]/
      );

  return Array.from(
    new Set(
      source
        .map((item) =>
          String(item).trim()
        )
        .filter(Boolean)
    )
  );
}

function normalizeRecipients(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: Array<{
    name: string | null;
    email: string;
  }> = [];

  for (const item of value) {
    const recipient =
      item as RequestedRecipient;

    const email = String(
      recipient?.email ?? ""
    ).trim();

    if (!email) continue;

    const key =
      email.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      name:
        recipient?.name == null
          ? null
          : String(
              recipient.name
            ).trim() || null,
      email,
    });
  }

  return result;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bodyToHtml(body: string) {
  return escapeHtml(body)
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br />");
}

function buildEmailHtml({
  body,
  signatureHtml,
}: {
  body: string;
  signatureHtml: string;
}) {
  const bodyHtml =
    bodyToHtml(body);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#111827;">
      <div>${bodyHtml}</div>
      ${
        signatureHtml.trim()
          ? `<div style="margin-top:24px;">${signatureHtml}</div>`
          : ""
      }
    </div>
  `;
}

export async function POST(
  request: NextRequest
) {
  try {
    const supabase =
      await createRouteSupabaseClient(
        request
      );

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
        },
        { status: 401 }
      );
    }

    const payload =
      await request.json();

    const mode =
      payload.mode === "send"
        ? "send"
        : "preview";

    const recipients =
      normalizeRecipients(
        payload.toRecipients
      );

    const cc =
      parseEmailList(payload.cc);
    const bcc =
      parseEmailList(
        payload.bcc
      );

    const subject = String(
      payload.subject ?? ""
    ).trim();

    const body = String(
      payload.body ?? ""
    ).trim();

    if (
      recipients.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "받는 사람을 한 명 이상 추가해주세요.",
        },
        { status: 400 }
      );
    }

    const invalidTo =
      recipients
        .map(
          (item) => item.email
        )
        .filter(
          (email) =>
            !isValidEmail(email)
        );

    const invalidCc =
      cc.filter(
        (email) =>
          !isValidEmail(email)
      );

    const invalidBcc =
      bcc.filter(
        (email) =>
          !isValidEmail(email)
      );

    if (
      invalidTo.length ||
      invalidCc.length ||
      invalidBcc.length
    ) {
      return NextResponse.json(
        {
          error: [
            invalidTo.length
              ? `받는 사람 이메일 형식을 확인해주세요: ${invalidTo.join(
                  ", "
                )}`
              : "",
            invalidCc.length
              ? `참조(CC) 이메일 형식을 확인해주세요: ${invalidCc.join(
                  ", "
                )}`
              : "",
            invalidBcc.length
              ? `숨은참조(BCC) 이메일 형식을 확인해주세요: ${invalidBcc.join(
                  ", "
                )}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
        { status: 400 }
      );
    }

    if (!subject || !body) {
      return NextResponse.json(
        {
          error:
            "메일 제목과 본문을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const admin =
      createAdminClient();

    const {
      data: connection,
      error: connectionError,
    } = await admin
      .from("gmail_connections")
      .select(
        "google_email, refresh_token"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      connectionError ||
      !connection?.refresh_token ||
      !connection?.google_email
    ) {
      return NextResponse.json(
        {
          code:
            "GMAIL_NOT_CONNECTED",
          error: connectionError
            ? `Gmail 연결 조회 실패: ${connectionError.message}`
            : "연결된 Gmail 계정이 없습니다.",
        },
        {
          status:
            connectionError
              ? 500
              : 409,
        }
      );
    }

    let signatureHtml = "";

    try {
      signatureHtml =
        await getGmailSignature({
          refreshToken:
            connection.refresh_token,
          email:
            connection.google_email,
        });
    } catch (error) {
      console.error(
        "Gmail signature lookup failed:",
        error
      );
    }

    const html =
      buildEmailHtml({
        body,
        signatureHtml,
      });

    if (mode === "preview") {
      return NextResponse.json({
        success: true,
        sender:
          connection.google_email,
        hasSignature:
          Boolean(
            signatureHtml.trim()
          ),
        previews:
          recipients.map(
            (recipient) => ({
              recipientName:
                recipient.name,
              recipientEmail:
                recipient.email,
              cc,
              bcc,
              subject,
              body,
              html,
            })
          ),
      });
    }

    const results: Array<{
      name: string | null;
      email: string;
      status:
        | "sent"
        | "failed";
      error?: string | null;
    }> = [];

    for (const recipient of recipients) {
      try {
        await sendGmail({
          refreshToken:
            connection.refresh_token,
          to: recipient.email,
          cc,
          bcc,
          subject,
          body,
          html,
        });

        results.push({
          name: recipient.name,
          email: recipient.email,
          status: "sent",
          error: null,
        });
      } catch (error) {
        results.push({
          name: recipient.name,
          email: recipient.email,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "메일 발송 중 오류가 발생했습니다.",
        });
      }
    }

    const sent =
      results.filter(
        (item) =>
          item.status === "sent"
      ).length;

    const failed =
      results.filter(
        (item) =>
          item.status === "failed"
      ).length;

    return NextResponse.json({
      success: true,
      sender:
        connection.google_email,
      total: results.length,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error(
      "General Gmail send error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "메일 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
