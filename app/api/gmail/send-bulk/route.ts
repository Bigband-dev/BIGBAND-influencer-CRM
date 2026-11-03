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

export async function POST(request: NextRequest) {
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
    subject?: string;
    body?: string;
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
  const subjectTemplate = String(payload.subject ?? "").trim();
  const bodyTemplate = String(payload.body ?? "").trim();

  if (!campaignId) {
    return NextResponse.json(
      { error: "캠페인 ID가 없습니다." },
      { status: 400 }
    );
  }

  if (campaignInfluencerIds.length === 0) {
    return NextResponse.json(
      { error: "메일을 보낼 인플루언서를 선택해주세요." },
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
        error: connectionError
          ? `Gmail 연결 조회 실패: ${connectionError.message}`
          : "연결된 Gmail 계정이 없습니다.",
      },
      { status: 400 }
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

  const members: CampaignMemberRow[] = [];

  for (
    let index = 0;
    index < campaignInfluencerIds.length;
    index += 100
  ) {
    const idChunk = campaignInfluencerIds.slice(index, index + 100);

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
    const previewMember = campaignInfluencerIds
      .map((id) => memberMap.get(id))
      .find(Boolean);

    if (!previewMember) {
      return NextResponse.json(
        { error: "미리보기할 수신자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const influencer = getInfluencer(previewMember);

    if (!influencer) {
      return NextResponse.json(
        { error: "미리보기할 수신자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const variables = {
      name: influencer.name?.trim() || "인플루언서",
      campaign: campaign.name ?? "",
      brand: campaign.brand ?? "",
      product: campaign.product ?? "",
    };

    const previewSubject = replaceTemplate(
      subjectTemplate,
      variables
    );
    const previewBody = replaceTemplate(
      bodyTemplate,
      variables
    );

    return NextResponse.json({
      success: true,
      sender: connection.google_email,
      recipientName: influencer.name,
      recipientEmail: influencer.email,
      subject: previewSubject,
      body: previewBody,
      html: buildEmailHtml({
        body: previewBody,
        signatureHtml,
      }),
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

  for (const campaignInfluencerId of campaignInfluencerIds) {
    const member = memberMap.get(campaignInfluencerId);

    if (!member) {
      results.push({
        campaignInfluencerId,
        influencerId: "",
        name: null,
        email: null,
        status: "skipped",
        error: "캠페인 인플루언서 정보를 찾을 수 없습니다.",
      });
      continue;
    }

    const influencer = getInfluencer(member);
    const influencerId = influencer?.id ?? member.influencer_id;
    const influencerName =
      influencer?.name?.trim() || "인플루언서";
    const recipientEmail =
      influencer?.email?.trim() || null;

    if (!recipientEmail) {
      results.push({
        campaignInfluencerId,
        influencerId,
        name: influencer?.name ?? null,
        email: null,
        status: "skipped",
        error: "이메일 주소가 없습니다.",
      });
      continue;
    }

    const variables = {
      name: influencerName,
      campaign: campaign.name ?? "",
      brand: campaign.brand ?? "",
      product: campaign.product ?? "",
    };

    const subject = replaceTemplate(subjectTemplate, variables);
    const body = replaceTemplate(bodyTemplate, variables);
    const html = buildEmailHtml({ body, signatureHtml });

    try {
      const sendResult = await sendGmail({
        refreshToken: connection.refresh_token,
        to: recipientEmail,
        subject,
        body,
        html,
      });

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
        console.error("campaign_email_sends insert error:", historyError);
      }

      results.push({
        campaignInfluencerId,
        influencerId,
        name: influencer?.name ?? null,
        email: recipientEmail,
        status: "sent",
        error: historyError
          ? `메일은 발송됐지만 이력 저장 실패: ${historyError.message}`
          : null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Gmail 발송 중 오류가 발생했습니다.";
      const now = new Date().toISOString();

      const { error: failedHistoryError } = await admin
        .from("campaign_email_sends")
        .insert({
          campaign_id: campaignId,
          campaign_influencer_id: campaignInfluencerId,
          influencer_id: influencerId,
          sender_user_id: user.id,
          recipient_email: recipientEmail,
          subject,
          body,
          gmail_message_id: null,
          gmail_thread_id: null,
          status: "failed",
          sent_at: null,
          failed_at: now,
          error_message: errorMessage,
          reminder_due_at: null,
          reminder_sent_at: null,
          reply_detected_at: null,
        });

      if (failedHistoryError) {
        console.error(
          "failed campaign_email_sends insert error:",
          failedHistoryError
        );
      }

      results.push({
        campaignInfluencerId,
        influencerId,
        name: influencer?.name ?? null,
        email: recipientEmail,
        status: "failed",
        error: errorMessage,
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
}
