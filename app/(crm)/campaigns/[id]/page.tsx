import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DeleteCampaignButton from "@/components/delete-campaign-button";

import CampaignInfluencerManager
  from "@/components/campaign-influencer-manager";
import { formatPriceMan } from "@/lib/format-number";

export const instant = false;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: campaign, error } =
    await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

  if (error || !campaign) {
    notFound();
  }

  /*
   * Supabase/PostgREST의 단일 select 반환 제한을 피하기 위해
   * 전체 인플루언서를 500명씩 끝까지 불러옵니다.
   */
  const influencers: any[] = [];
  const INFLUENCER_PAGE_SIZE = 500;
  let influencerFrom = 0;

  while (true) {
    const { data, error: influencerLoadError } =
      await supabase
        .from("influencers")
        .select(`
          id,
          name,
          instagram_id,
          followers,
          avg_views,
          category,
          collaboration_rate
        `)
        .order("followers", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(
          influencerFrom,
          influencerFrom + INFLUENCER_PAGE_SIZE - 1
        );

    if (influencerLoadError) {
      throw new Error(
        `인플루언서 목록 조회 실패: ${influencerLoadError.message}`
      );
    }

    influencers.push(...(data ?? []));

    if (!data || data.length < INFLUENCER_PAGE_SIZE) {
      break;
    }

    influencerFrom += INFLUENCER_PAGE_SIZE;
  }

  /*
   * 캠페인 연결도 1,000건 이상일 수 있으므로 동일하게 페이지네이션합니다.
   */
  const campaignInfluencers: any[] = [];
  const CAMPAIGN_MEMBER_PAGE_SIZE = 500;
  let campaignMemberFrom = 0;

  while (true) {
    const { data, error: campaignMemberLoadError } =
      await supabase
        .from("campaign_influencers")
        .select(`
          id,
          influencer_id,
          email,
          status,
          proposed_rate,
          final_rate,
          memo,
          influencers (
            id,
            name,
            instagram_id,
            followers,
            avg_views,
            category,
            collaboration_rate
          )
        `)
        .eq("campaign_id", id)
        .order("id", {
          ascending: true,
        })
        .range(
          campaignMemberFrom,
          campaignMemberFrom + CAMPAIGN_MEMBER_PAGE_SIZE - 1
        );

    if (campaignMemberLoadError) {
      throw new Error(
        `캠페인 인플루언서 조회 실패: ${campaignMemberLoadError.message}`
      );
    }

    campaignInfluencers.push(...(data ?? []));

    if (
      !data ||
      data.length < CAMPAIGN_MEMBER_PAGE_SIZE
    ) {
      break;
    }

    campaignMemberFrom += CAMPAIGN_MEMBER_PAGE_SIZE;
  }

  const { data: campaignLogsRaw } = 
    await supabase
      .from("audit_logs")
      .select(`
        id,
        actor_id,
        action,
        old_data,
        new_data,
        created_at
      `)
      .eq("table_name", "campaigns")
      .eq("record_id", id)
      .in("action", ["INSERT", "UPDATE", "DELETE"])
      .order("created_at", {
        ascending: false,
      })
      .limit(10);

  const actorIds = [
    ...new Set(
      (campaignLogsRaw ?? [])
        .map((log) => log.actor_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: actors } =
    actorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", actorIds)
      : { data: [] };

  const actorMap = new Map(
    (actors ?? []).map((actor) => [
      actor.id,
      actor,
    ])
  );

  const campaignLogs = (
    campaignLogsRaw ?? []
  ).map((log) => {
    const actor = log.actor_id
      ? actorMap.get(log.actor_id)
      : null;

    return {
      ...log,
      actor_name: actor?.name ?? null,
      actor_email: actor?.email ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-bold">
            {campaign.name}
          </h1>

          <p className="mt-2 text-slate-500">
            {"광고주 : " + (campaign.brand || "-")}

            {campaign.product
              ? ` / 제품 : ${campaign.product}`
              : ""}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className="rounded-lg border-2 border-slate-400 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            수정
          </Link>

          <DeleteCampaignButton
            campaignId={campaign.id}
            campaignName={campaign.name}
          />
        </div>
      </div>

      <section className="mb-6 rounded-xl border-2 border-slate-400 bg-white p-6">
        <h2 className="mb-5 text-lg font-bold">
          캠페인 정보
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-500">
              캠페인 목적
            </p>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-900">
              {campaign.purpose || "-"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              캠페인 예산
            </p>

            <p className="mt-2 text-lg font-bold">
              {formatPriceMan(campaign.budget)}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              진행 플랫폼
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {campaign.platforms?.length ? (
                campaign.platforms.map(
                  (platform: string) => (
                    <span
                      key={platform}
                      className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-medium"
                    >
                      {platform}
                    </span>
                  )
                )
              ) : (
                <span>-</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">
              메모
            </p>

            <p className="mt-2 whitespace-pre-line text-sm leading-6">
              {campaign.description || "-"}
            </p>
          </div>
        </div>
      </section>

      <CampaignInfluencerManager
        campaignId={id}
        influencers={influencers ?? []}
        campaignInfluencers={
          campaignInfluencers ?? []
        }
      />
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 hover:bg-slate-50">
            <div>
              <h2 className="text-lg font-semibold">
                변경 이력
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                이 캠페인의 최근 등록 / 수정 기록
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              최근 {campaignLogs.length}건
            </span>
          </summary>

          <div className="border-t border-slate-200">
            {campaignLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">
                변경 이력이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {campaignLogs.map((log) => {
                  const changes =
                    log.action === "UPDATE"
                      ? getCampaignChangedFields(
                          log.old_data,
                          log.new_data
                        )
                      : [];

                  return (
                    <div
                      key={log.id}
                      className="flex items-start justify-between gap-6 px-6 py-4"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            log.action === "INSERT"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : log.action === "UPDATE"
                                ? "border-blue-300 bg-blue-50 text-blue-700"
                                : "border-red-300 bg-red-50 text-red-700"
                          }`}
                        >
                          {log.action === "INSERT"
                            ? "등록"
                            : log.action === "UPDATE"
                              ? "수정"
                              : "삭제"}
                        </span>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {log.actor_name ||
                              log.actor_email ||
                              "알 수 없는 사용자"}
                          </p>

                          {log.actor_name &&
                            log.actor_email && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                {log.actor_email}
                              </p>
                            )}

                          {changes.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-slate-500">
                              {changes
                                .slice(0, 3)
                                .map((change) => (
                                  <p key={change.key}>
                                    {change.label}:{" "}
                                    {formatCampaignAuditValue(
                                      change.key,
                                      change.oldValue
                                    )}
                                    {" → "}
                                    {formatCampaignAuditValue(
                                      change.key,
                                      change.newValue
                                    )}
                                  </p>
                                ))}

                              {changes.length > 3 && (
                                <p className="text-slate-400">
                                  외 {changes.length - 3}개 변경
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="shrink-0 text-xs text-slate-500">
                        {new Date(
                          log.created_at
                        ).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
    
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border-2 border-slate-400 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function getCampaignChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
) {
  if (!oldData || !newData) return [];

  const ignoredFields = [
    "id",
    "created_at",
    "updated_at",
  ];

  const labelMap: Record<string, string> = {
    name: "캠페인명",
    brand: "광고주",
    product: "제품",
    purpose: "목적",
    platforms: "플랫폼",
    budget: "예산",
    description: "설명",
    start_date: "시작일",
    end_date: "종료일",
    status: "진행 상태",
  };

  return Object.keys(newData)
    .filter(
      (key) =>
        !ignoredFields.includes(key) &&
        JSON.stringify(oldData[key]) !==
          JSON.stringify(newData[key])
    )
    .map((key) => ({
      key,
      label: labelMap[key] || key,
      oldValue: oldData[key],
      newValue: newData[key],
    }));
}

function formatCampaignAuditValue(
  key: string,
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "없음";
  }

  if (key === "budget") {
    return formatPriceMan(Number(value));
  }

  if (key === "platforms") {
    return Array.isArray(value)
      ? value.join(", ")
      : String(value);
  }

  return String(value);
}