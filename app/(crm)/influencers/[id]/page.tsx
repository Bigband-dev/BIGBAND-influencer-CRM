import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteInfluencerButton from "@/components/delete-influencer-button";
import {
  formatMan,
  formatPriceMan,
} from "@/lib/format-number";
import {
  getCampaignInfluencerStatusLabel,
  getCampaignInfluencerStatusClass,
} from "@/lib/campaign-status";
import PlatformBadge from "@/components/platform-badge";
import type {
  InfluencerChannel,
} from "@/types/influencer";
import { buildGmailComposeUrl } from "@/lib/gmail-compose";
export const instant = false;
export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  const { data: influencer, error } = await supabase
    .from("influencers")
    .select(`
      *,
      channels:influencer_channels (
        id,
        influencer_id,
        platform,
        channel_name,
        handle,
        url,
        followers,
        avg_views,
        collaboration_rate,
        is_primary,
        memo
      )
    `)
    .eq("id", id)
    .single();
  if (error || !influencer) {
    notFound();
  }
  const channels: InfluencerChannel[] =
    influencer.channels ?? [];
  const primaryChannel =
    channels.find(
      (channel) => channel.is_primary
    ) ??
    channels[0] ??
    null;
  const categories: string[] =
    influencer.categories?.length
      ? influencer.categories
      : influencer.category
        ? [influencer.category]
        : [];
  const gmailUrl = influencer.email
    ? buildGmailComposeUrl({
        email: influencer.email,
        influencerName: influencer.name,
        userName: currentProfile?.name ?? null,
      })
    : null;
  const { data: campaignHistory } =
    await supabase
      .from("campaign_influencers")
      .select(`
        id,
        status,
        proposed_rate,
        final_rate,
        memo,
        created_at,
        campaigns (
          id,
          name,
          brand,
          product,
          start_date,
          end_date
        )
      `)
      .eq("influencer_id", id)
      .order("created_at", {
        ascending: false,
      });
  const { data: influencerLogsRaw } = await supabase
    .from("audit_logs")
    .select(`
      id,
      actor_id,
      action,
      old_data,
      new_data,
      created_at
    `)
    .eq("table_name", "influencers")
    .eq("record_id", id)
    .in("action", ["INSERT", "UPDATE", "DELETE"])
    .order("created_at", {
      ascending: false,
    })
    .limit(10);
  const actorIds = [
    ...new Set(
      (influencerLogsRaw ?? [])
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
  const influencerLogs = (
    influencerLogsRaw ?? []
  ).map((log) => {
    const actor = log.actor_id
      ? actorMap.get(log.actor_id)
      : null;
    return {
      ...log,
      actor_name:
        actor?.name ?? null,
      actor_email:
        actor?.email ?? null,
    };
  });
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/influencers"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← 인플루언서 목록
        </Link>
        <div className="mt-5 rounded-xl border border-slate-300 bg-white p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">
                  {influencer.name ||
                    primaryChannel?.channel_name ||
                    primaryChannel?.handle ||
                    "이름 없음"}
                </h1>
                {primaryChannel && (
                  <PlatformBadge
                    platform={primaryChannel.platform}
                  />
                )}
              </div>
              {primaryChannel && (
                <div className="mt-2 text-sm text-slate-500">
                  {primaryChannel.channel_name && (
                    <span>
                      {primaryChannel.channel_name}
                    </span>
                  )}
                  {primaryChannel.handle && (
                    <span
                      className={
                        primaryChannel.channel_name
                          ? "ml-2"
                          : ""
                      }
                    >
                      @{primaryChannel.handle}
                    </span>
                  )}
                </div>
              )}
              {channels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {channels.map((channel, index) => (
                    <PlatformBadge
                      key={
                        channel.id ??
                        `${channel.platform}-${index}`
                      }
                      platform={channel.platform}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/influencers/${influencer.id}/edit`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                수정
              </Link>
              <DeleteInfluencerButton
                influencerId={influencer.id}
                influencerName={
                  influencer.name ||
                  primaryChannel?.handle ||
                  "인플루언서"
                }
              />
              {primaryChannel?.url && (
                <a
                  href={primaryChannel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  대표 채널 열기
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {/* 기본 정보 */}
          <section className="rounded-xl border border-slate-300 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">
              기본 정보
            </h2>
            <div className="space-y-4 text-sm">
              <Info
                label="이름"
                value={influencer.name}
              />
              <div className="flex justify-between gap-5 border-b border-slate-100 pb-3">
                <span className="text-slate-500">이메일</span>
                {influencer.email && gmailUrl ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {influencer.email}
                    </span>
                    <a
                      href={gmailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      메일 보내기
                    </a>
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </div>
              <div className="border-b border-slate-100 pb-3">
                <div className="mb-2 text-slate-500">
                  카테고리
                </div>
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">
                    -
                  </span>
                )}
              </div>
              <Info
                label="성별"
                value={influencer.gender}
              />
              <Info
                label="연령대"
                value={influencer.age_group}
              />
            </div>
          </section>
          {/* 협업 정보 */}
          <section className="rounded-xl border border-slate-300 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">
              협업 정보
            </h2>
            <div className="space-y-4 text-sm">
              <Info
                label="대표 채널 단가"
                value={
                  primaryChannel
                    ? formatPriceMan(
                        primaryChannel.collaboration_rate ??
                          influencer.collaboration_rate
                      )
                    : formatPriceMan(influencer.collaboration_rate)
                }
              />
              <Info
                label="등록 채널 수"
                value={`${channels.length}개`}
              />
              <Info
                label="대표 채널"
                value={
                  primaryChannel
                    ? getPlatformLabel(
                        primaryChannel.platform
                      )
                    : "-"
                }
              />
              <Info
                label="대표 채널 팔로워"
                value={
                  primaryChannel
                    ? formatMan(
                        primaryChannel.followers
                      )
                    : "-"
                }
              />
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-xl border border-slate-300 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                채널 정보
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                등록된 SNS 및 콘텐츠 채널입니다.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {channels.length}개
            </span>
          </div>
          {channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400">
              등록된 채널이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {channels.map((channel, index) => (
                <div
                  key={
                    channel.id ??
                    `${channel.platform}-${index}`
                  }
                  className={`rounded-xl border p-5 ${
                    channel.is_primary
                      ? "border-slate-500 bg-slate-50"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {/* 플랫폼 / 대표채널 */}
                  <div className="flex items-center justify-between gap-3">
                    <PlatformBadge
                      platform={channel.platform}
                    />
                    {channel.is_primary && (
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        대표 채널
                      </span>
                    )}
                  </div>
                  {/* 채널명 / ID */}
                  <div className="mt-4">
                    <p className="font-semibold text-slate-900">
                      {channel.channel_name ||
                        (channel.handle
                          ? `@${channel.handle}`
                          : "채널명 없음")}
                    </p>
                    {channel.channel_name &&
                      channel.handle && (
                        <p className="mt-1 text-sm text-slate-500">
                          @{channel.handle}
                        </p>
                      )}
                  </div>
                  {/* 지표 */}
                  <div className="mt-5 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">팔로워 / 구독자</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatMan(channel.followers)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">평균 조회수</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatMan(channel.avg_views)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">최근 협업 단가</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatPriceMan(channel.collaboration_rate)}
                      </p>
                    </div>
                  </div>
                  {/* 메모 */}
                  {channel.memo && (
                    <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {channel.memo}
                    </div>
                  )}
                  {/* 링크 */}
                  {channel.url && (
                    <a
                      href={channel.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      채널 열기
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">
            내부 메모
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {influencer.memo ||
              "등록된 메모가 없습니다."}
          </p>
        </section>
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold">
              캠페인 제안 / 협업 이력
            </h2>
          </div>
          {!campaignHistory?.length ? (
            <div className="p-10 text-center text-sm text-slate-400">
              아직 등록된 캠페인 이력이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {campaignHistory.map(
                (history) => {
                  const campaign =
                    Array.isArray(
                      history.campaigns
                    )
                      ? history
                          .campaigns[0]
                      : history.campaigns;
                  if (!campaign) {
                    return null;
                  }
                  return (
                    <Link
                      key={history.id}
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center justify-between px-6 py-5 transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {campaign.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {campaign.brand ||
                            "-"}
                          {campaign.product
                            ? ` · ${campaign.product}`
                            : ""}
                        </p>
                        {(campaign.start_date ||
                          campaign.end_date) && (
                          <p className="mt-1 text-xs text-slate-400">
                            {campaign.start_date ||
                              "-"}
                            {" ~ "}
                            {campaign.end_date ||
                              "-"}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getCampaignInfluencerStatusClass(
                            history.status
                          )}`}
                        >
                          {getCampaignInfluencerStatusLabel(
                            history.status
                          )}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">
                          {history.final_rate
                            ? formatPriceMan(
                                history.final_rate
                              )
                            : history.proposed_rate
                              ? `제안 ${formatPriceMan(
                                  history.proposed_rate
                                )}`
                              : "-"}
                        </p>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </section>
        <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 hover:bg-slate-50">
              <div>
                <h2 className="text-lg font-semibold">
                  변경 이력
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  이 인플루언서의 최근 등록 / 수정 기록
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                최근 {influencerLogs.length}건
              </span>
            </summary>
            <div className="border-t border-slate-200">
              {influencerLogs.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">
                  변경 이력이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {influencerLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-6 px-6 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
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
                          <p className="truncate text-sm font-medium text-slate-800">
                            {log.actor_name ||
                              log.actor_email ||
                              "알 수 없는 사용자"}
                          </p>
                          {log.actor_name &&
                            log.actor_email && (
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                {log.actor_email}
                              </p>
                            )}
                          {log.action === "UPDATE" && (
                            <div className="mt-1 text-xs text-slate-500">
                              {getChangedFields(
                                log.old_data,
                                log.new_data
                              )
                                .slice(0, 3)
                                .map((change) => (
                                  <span
                                    key={change.key}
                                    className="mr-3"
                                  >
                                    {change.label}:{" "}
                                    {formatAuditValue(
                                      change.key,
                                      change.oldValue
                                    )}
                                    {" → "}
                                    {formatAuditValue(
                                      change.key,
                                      change.newValue
                                    )}
                                  </span>
                                ))}
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
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  return (
    <div className="flex justify-between gap-5 border-b border-slate-100 pb-3">
      <span className="text-slate-500">
        {label}
      </span>
      <span className="text-right font-medium text-slate-900">
        {value || "-"}
      </span>
    </div>
  );
}
function getChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
) {
  if (!oldData || !newData) return [];
  const ignoredFields = [
    "updated_at",
    "created_at",
    "id",
  ];
  const labelMap: Record<string, string> = {
    name: "이름",
    instagram_id: "Instagram ID",
    instagram_url: "Instagram URL",
    email: "이메일",
    phone: "전화번호",
    followers: "팔로워",
    avg_views: "평균 조회수",
    category: "대표 카테고리",
    categories: "카테고리",
    gender: "성별",
    age_group: "연령대",
    collaboration_rate: "협업 단가",
    memo: "메모",
  };
  return Object.keys(newData)
    .filter(
      (key) =>
        !ignoredFields.includes(key) &&
        oldData[key] !== newData[key]
    )
    .map((key) => ({
      key,
      label: labelMap[key] || key,
      oldValue: oldData[key],
      newValue: newData[key],
    }));
}
function formatAuditValue(
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
  if (
    key === "categories" &&
    Array.isArray(value)
  ) {
    return value.length > 0
      ? value.join(", ")
      : "없음";
  }
  if (
    key === "followers" ||
    key === "avg_views"
  ) {
    return formatMan(Number(value));
  }
  if (key === "collaboration_rate") {
    return formatPriceMan(
      Number(value)
    );
  }
  return String(value);
}
function getPlatformLabel(
  platform: string
) {
  const labels: Record<
    string,
    string
  > = {
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    naver_blog: "Naver Blog",
    xiaohongshu: "Xiaohongshu",
  };
  return (
    labels[platform] ||
    platform
  );
}
