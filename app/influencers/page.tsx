import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InfluencerTable from "@/components/influencer-table";
import LogoutButton from "@/components/logout-button";
export const instant = false;

export default async function InfluencersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: influencers, error } = await supabase
    .from("influencers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-10 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">
            데이터 조회 오류
          </h1>

          <p className="mt-4 text-red-600">
            {error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* 상단 영역 */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-500">
              Influencer Management
            </p>

            <h1 className="text-3xl font-bold tracking-tight">
              Influencer DB
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              인플루언서 검색, 이력 및 캠페인 관리를 위한 내부 DB
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex gap-3">
             <Link
                href="/influencers/import"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Excel 업로드
              </Link>
            <Link
              href="/influencers/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              + 인플루언서 추가
            </Link>

            <LogoutButton />
          </div>
        </div>

        {/* 인플루언서 목록 */}
        <InfluencerTable influencers={influencers ?? []} />

      </div>
    </main>
  );
}