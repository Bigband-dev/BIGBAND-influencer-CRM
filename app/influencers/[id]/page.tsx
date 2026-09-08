import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatMan,
  formatPriceMan,
} from "@/lib/format-number";

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

  const { data: influencer, error } = await supabase
    .from("influencers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !influencer) {
    notFound();
  }

  const { data: campaignHistory } = await supabase
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
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">

        <Link
          href="/influencers"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← 인플루언서 목록
        </Link>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Influencer
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                {influencer.name || influencer.instagram_id}
              </h1>

              <p className="mt-2 text-slate-500">
                @{influencer.instagram_id}
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/influencers/${influencer.id}/edit`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                수정
              </Link>

              {influencer.instagram_url && (
                <a
                  href={influencer.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Instagram 열기
                </a>
              )}
            </div>

          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold">
              기본 정보
            </h2>

            <div className="space-y-4 text-sm">
              <Info
                label="이름"
                value={influencer.name}
              />

              <Info
                label="Instagram ID"
                value={`@${influencer.instagram_id}`}
              />

              <Info
                label="이메일"
                value={influencer.email}
              />

              <Info
                label="카테고리"
                value={influencer.category}
              />

              <Info
                label="세부 카테고리"
                value={influencer.subcategory}
              />

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

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold">
              성과 및 단가
            </h2>

            <div className="space-y-4 text-sm">
              <Info
                label="팔로워"
                  value={formatMan(influencer.followers)}
              />

              <Info
                label="평균 조회수"
                value={formatMan(influencer.avg_views)}
              />

              <Info
                label="최근 협업 단가"
                  value={formatPriceMan(
                    influencer.collaboration_rate
                  )}
              />
            </div>
          </section>

        </div>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">
            내부 메모
          </h2>

          <p className="whitespace-pre-wrap text-sm text-slate-600">
            {influencer.memo || "등록된 메모가 없습니다."}
          </p>
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white">
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
            <div className="divide-y divide-slate-100">
              {campaignHistory.map((history) => {
                const campaign = Array.isArray(history.campaigns)
                  ? history.campaigns[0]
                  : history.campaigns;

                return (
                  <div
                    key={history.id}
                    className="flex items-center justify-between px-6 py-5"
                  >
                    <div>
                      <p className="font-medium">
                        {campaign?.name || "-"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {campaign?.brand || "-"}
                        {campaign?.product
                          ? ` · ${campaign.product}`
                          : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {history.status}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {history.final_rate
                          ? `${history.final_rate.toLocaleString()}원`
                          : history.proposed_rate
                            ? `제안 ${history.proposed_rate.toLocaleString()}원`
                            : "-"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
  value: string | number | null | undefined;
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