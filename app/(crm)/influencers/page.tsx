import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InfluencerTable from "@/components/influencer-table";
import LogoutButton from "@/components/logout-button";
import Sidebar from "@/components/sidebar";
export const instant = false;

export default async function InfluencersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  let currentUserName: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    currentUserName = profile?.name ?? null;
  }

  /*
   * Supabase/PostgREST는 한 번의 select에서 반환 행 수 제한이 있을 수 있으므로
   * 인플루언서 목록은 500명씩 끝까지 페이지네이션해서 가져옵니다.
   */
  const influencers: any[] = [];
  const PAGE_SIZE = 500;
  let from = 0;
  let loadError: Error | null = null;

  while (true) {
    const { data, error } = await supabase
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
          is_primary,
          memo
        )
      `)
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      loadError = new Error(error.message);
      break;
    }

    influencers.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  /*
   * 마케터 화면의 "전체 인플루언서"는 실제 운영 계정 수를 기준으로 표시합니다.
   * 현재 Excel/Importer는 채널(플랫폼 + 아이디)을 실질적인 고유 계정으로 사용하므로
   * 부풀어 있는 legacy influencers 행 수가 아니라 influencer_channels의 실제 행 수를 씁니다.
   */
  const {
    count: totalRegisteredInfluencers,
    error: channelCountError,
  } = await supabase
    .from("influencer_channels")
    .select("id", {
      count: "exact",
      head: true,
    });

  if (
    loadError ||
    channelCountError
  ) {
    const message =
      loadError?.message ??
      channelCountError?.message ??
      "데이터 조회 중 오류가 발생했습니다.";

    return (
      <main className="min-h-screen bg-slate-50 p-10 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">
            데이터 조회 오류
          </h1>

          <p className="mt-4 text-red-600">
            {message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-8 py-8">

        <div className="mb-8 flex items-start justify-between">
          {/* 상단 영역 */}
          <div>
            
          </div>
          {/* 버튼 영역 */}
          <div className="flex gap-3">
            <Link
              href="/influencers/import"
              className="rounded-lg border-2 border-slate-500 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Excel 업로드
            </Link>

            <Link
              href="/influencers/new"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              + 인플루언서 추가
            </Link>

          </div>

        </div>
        {/* 인플루언서 목록 */}
        <InfluencerTable
          influencers={influencers}
          currentUserName={currentUserName}
          totalRegisteredInfluencers={
            totalRegisteredInfluencers ?? 0
          }
        />

      </div>
  </div>
  );
}