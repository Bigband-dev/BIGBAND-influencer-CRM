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
        <InfluencerTable influencers={influencers ?? []} />

      </div>
  </div>
  );
}