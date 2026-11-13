import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildEmailHtml,
  getGmailSignature,
  sendGmail,
} from "@/lib/google/gmail";

type InfluencerRelation = {
  id: string;
  name: string | null;
  email: string | null;
};

type CampaignMemberRow = {
  id: string;
  influencer_id: string;
  influencers: InfluencerRelation | InfluencerRelation[] | null;
};

type RequestedToRecipient = {
  name?: string | null;
  email?: string | null;
  campaignInfluencerId?: string | null;
  influencerId?: string | null;
};

function replaceTemplate(
  template: string,
  variables: Record<string, string>
) {
  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replace(
        new RegExp(`{{\\s*${key}\\s*}}`, "gi"),
        value
      ),
    template
  );
}

function getInfluencer(member: CampaignMemberRow) {
  return Array.isArray(member.influencers)
    ? member.influencers[0] ?? null
    : member.influencers;
}

function parseEmailList(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[;,\n]/);

  return Array.from(
    new Set(
      source
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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
    mode?: "preview" | "send";
    campaignId?: string;
    campaignInfluencerIds?: string[];
    toRecipients?: RequestedToRecipient[];
    subject?: string;
    body?: string;
    cc?: string | string[];
    bcc?: string | string[];
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  const mode = payload.mode === "preview" ? "preview" : "send";
  const campaignId = String(payload.campaignId ?? "").trim();
  const campaignInfluencerIds = Array.from(
    new Set(
      Array.isArray(payload.campaignInfluencerIds)
        ? payload.campaignInfluencerIds
            .map((value) => String(value).trim())
            .filter(Boolean)
        : []
    )
  );
  const requestedToRecipients: RequestedToRecipient[] =
    Array.isArray(payload.toRecipients)
      ? payload.toRecipients
          .map((item) => ({
            name:
              item?.name == null
                ? null
                : String(item.name).trim() || null,
            email:
              item?.email == null
                ? null
                : String(item.email).trim() || null,
            campaignInfluencerId:
              item?.campaignInfluencerId == null
                ? null
                : String(item.campaignInfluencerId).trim() || null,
            influencerId:
              item?.influencerId == null
                ? null
                : String(item.influencerId).trim() || null,
          }))
          .filter((item) => Boolean(item.email))
      : [];

  const individualizedTargets = requestedToRecipients;

  const subjectTemplate = String(payload.subject ?? "").trim();
  const bodyTemplate = String(payload.body ?? "").trim();
  const cc = parseEmailList(payload.cc);
  const bcc = parseEmailList(payload.bcc);

  const invalidTo = individualizedTargets
    .map((item) => item.email)
    .filter((email): email is string => Boolean(email))
    .filter((email) => !isValidEmail(email));
  const invalidCc = cc.filter((email) => !isValidEmail(email));
  const invalidBcc = bcc.filter((email) => !isValidEmail(email));

  if (
    invalidTo.length > 0 ||
    invalidCc.length > 0 ||
    invalidBcc.length > 0
  ) {
    return NextResponse.json(
      {
        error: [
          invalidTo.length
            ? `받는 사람(To) 이메일 형식을 확인해주세요: ${invalidTo.join(", ")}`
            : "",
          invalidCc.length
            ? `참조(CC) 이메일 형식을 확인해주세요: ${invalidCc.join(", ")}`
            : "",
          invalidBcc.length
            ? `숨은참조(BCC) 이메일 형식을 확인해주세요: ${invalidBcc.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { status: 400 }
    );
  }

  if (!campaignId) {
    return NextResponse.json(
      { error: "캠페인 ID가 없습니다." },
      { status: 400 }
    );
  }

  if (individualizedTargets.length === 0) {
    return NextResponse.json(
      {
        error:
          "받는 사람 또는 숨은참조 수신자를 한 명 이상 추가해주세요.",
      },
      { status: 400 }
    );
  }

  if (!subjectTemplate || !bodyTemplate) {
    return NextResponse.json(
      { error: "메일 제목과 본문을 입력해주세요." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const {
    data: connection,
    error: connectionError,
  } = await admin
    .from("gmail_connections")
    .select("google_email, refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    connectionError ||
    !connection?.refresh_token ||
    !connection?.google_email
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
      { status: connectionError ? 500 : 409 }
    );
  }

  const {
    data: campaign,
    error: campaignError,
  } = await admin
    .from("campaigns")
    .select("id, name, brand, product")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json(
      {
        error: campaignError
          ? `캠페인 조회 실패: ${campaignError.message}`
          : "캠페인을 찾을 수 없습니다.",
      },
      { status: 404 }
    );
  }

  const requestedCampaignInfluencerIds = Array.from(
    new Set([
      ...campaignInfluencerIds,
      ...individualizedTargets
        .map((item) => item.campaignInfluencerId)
        .filter((value): value is string => Boolean(value)),
    ])
  );

  const members: CampaignMemberRow[] = [];

  for (
    let index = 0;
    index < requestedCampaignInfluencerIds.length;
    index += 100
  ) {
    const idChunk = requestedCampaignInfluencerIds.slice(index, index + 100);

    const {
      data,
      error: memberError,
    } = await admin
      .from("campaign_influencers")
      .select(`
        id,
        influencer_id,
        influencers (
          id,
          name,
          email
        )
      `)
      .eq("campaign_id", campaignId)
      .in("id", idChunk);

    if (memberError) {
      return NextResponse.json(
        { error: `수신자 조회 실패: ${memberError.message}` },
        { status: 500 }
      );
    }

    members.push(...((data ?? []) as CampaignMemberRow[]));
  }

  const memberMap = new Map(
    members.map((member) => [member.id, member])
  );

  let signatureHtml = "";

  try {
    signatureHtml = await getGmailSignature({
      refreshToken: connection.refresh_token,
      email: connection.google_email,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gmail 서명을 불러오지 못했습니다.";

    return NextResponse.json(
      {
        error:
          "Gmail 서명을 불러오지 못했습니다. " +
          `OAuth에 gmail.settings.basic 권한이 포함되어 있는지 확인해주세요. (${message})`,
      },
      { status: 400 }
    );
  }

  if (mode === "preview") {
    const previews = individualizedTargets
      .map((previewTarget) => {
        if (!previewTarget?.email) {
          return null;
        }

        const linkedMember = previewTarget.campaignInfluencerId
          ? memberMap.get(previewTarget.campaignInfluencerId)
          : null;

        const linkedInfluencer = linkedMember
          ? getInfluencer(linkedMember)
          : null;

        const displayName =
          linkedInfluencer?.name?.trim() ||
          previewTarget.name?.trim() ||
          "담당자";

        const variables = {
          인플루언서명: displayName,
          브랜드: campaign.brand ?? "",
          제품: campaign.product ?? "",
          캠페인명: campaign.name ?? "",
          name: displayName,
          brand: campaign.brand ?? "",
          product: campaign.product ?? "",
          campaign: campaign.name ?? "",
        };

        const previewSubject = replaceTemplate(
          subjectTemplate,
          variables
        );
        const previewBody = replaceTemplate(
          bodyTemplate,
          variables
        );

        return {
          recipientName:
            previewTarget.name ??
            linkedInfluencer?.name ??
            null,
          recipientEmail: previewTarget.email,
          cc,
          bcc,
          subject: previewSubject,
          body: previewBody,
          html: buildEmailHtml({
            body: previewBody,
            signatureHtml,
          }),
        };
      })
      .filter(
        (
          item
        ): item is {
          recipientName: string | null;
          recipientEmail: string;
          cc: string[];
          bcc: string[];
          subject: string;
          body: string;
          html: string;
        } => Boolean(item?.recipientEmail)
      );

    if (previews.length === 0) {
      return NextResponse.json(
        { error: "미리보기할 받는 사람을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sender: connection.google_email,
      previews,
      hasSignature: Boolean(signatureHtml.trim()),
    });
  }

  const results: Array<{
    campaignInfluencerId: string;
    influencerId: string;
    name: string | null;
    email: string | null;
    status: "sent" | "failed" | "skipped";
    error?: string | null;
  }> = [];

  for (const target of individualizedTargets) {
    const recipientEmail = target.email?.trim() || null;

    if (!recipientEmail) {
      continue;
    }

    const member = target.campaignInfluencerId
      ? memberMap.get(target.campaignInfluencerId)
      : null;

    const influencer = member
      ? getInfluencer(member)
      : null;

    const campaignInfluencerId =
      target.campaignInfluencerId ?? "";
    const influencerId =
      target.influencerId ??
      influencer?.id ??
      member?.influencer_id ??
      "";

    const recipientName =
      influencer?.name?.trim() ||
      target.name?.trim() ||
      null;

    const templateName =
      recipientName || "담당자";

    const variables = {
      인플루언서명: templateName,
      브랜드: campaign.brand ?? "",
      제품: campaign.product ?? "",
      캠페인명: campaign.name ?? "",
      name: templateName,
      brand: campaign.brand ?? "",
      product: campaign.product ?? "",
      campaign: campaign.name ?? "",
    };

    const subject = replaceTemplate(
      subjectTemplate,
      variables
    );
    const body = replaceTemplate(
      bodyTemplate,
      variables
    );
    const html = buildEmailHtml({
      body,
      signatureHtml,
    });

    try {
      const sendResult = await sendGmail({
        refreshToken: connection.refresh_token,
        to: recipientEmail,
        cc,
        bcc,
        subject,
        body,
        html,
      });

      let historyWarning: string | null = null;

      if (campaignInfluencerId && influencerId) {
        const now = new Date().toISOString();

        const { error: historyError } = await admin
          .from("campaign_email_sends")
          .insert({
            campaign_id: campaignId,
            campaign_influencer_id: campaignInfluencerId,
            influencer_id: influencerId,
            sender_user_id: user.id,
            recipient_email: recipientEmail,
            subject,
            body,
            gmail_message_id: sendResult.messageId,
            gmail_thread_id: sendResult.threadId,
            status: "sent",
            sent_at: now,
            failed_at: null,
            error_message: null,
            reminder_due_at: null,
            reminder_sent_at: null,
            reply_detected_at: null,
          });

        if (historyError) {
          console.error(
            "campaign_email_sends insert error:",
            historyError
          );
          historyWarning =
            `메일은 발송됐지만 이력 저장 실패: ${historyError.message}`;
        }
      }

      results.push({
        campaignInfluencerId,
        influencerId,
        name: recipientName,
        email: recipientEmail,
        status: "sent",
        error: historyWarning,
      });
    } catch (error) {
      results.push({
        campaignInfluencerId,
        influencerId,
        name: recipientName,
        email: recipientEmail,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "메일 발송 중 오류가 발생했습니다.",
      });
    }
  }

  const sent = results.filter((item) => item.status === "sent").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const skipped = results.filter((item) => item.status === "skipped").length;

  return NextResponse.json({
    success: true,
    sender: connection.google_email,
    total: results.length,
    sent,
    failed,
    skipped,
    results,
  });
  } catch (error) {
    console.error("send-bulk fatal error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "알 수 없는 서버 오류가 발생했습니다.";

    return NextResponse.json(
      {
        code: "MAIL_API_FATAL_ERROR",
        error: `메일 API 서버 오류: ${message}`,
      },
      { status: 500 }
    );
  }
}
