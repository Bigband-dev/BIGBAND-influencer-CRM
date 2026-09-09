import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/logout-button";
export const instant = false;
import Image from "next/image";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인하지 않은 사용자는 로그인 화면으로
  if (!user) {
    redirect("/login");
  }

  // 간단한 DB 통계
  const { count: influencerCount } = await supabase
    .from("influencers")
    .select("*", {
      count: "exact",
      head: true,
    });

  const { count: campaignCount } = await supabase
    .from("campaigns")
    .select("*", {
      count: "exact",
      head: true,
    });

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* 상단 */}
      <header className="border-b-2 border-slate-400 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div>
            <Image src="/logo.png" alt="Bigband logo" className="h-8 w-auto" width={64} height={64} />
            
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {user.email}
            </span>

            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-8 py-10">
        {/* Welcome */}
        <section className="mb-8">
          <p className="text-sm font-semibold text-slate-500">
            Dashboard
          </p>

          <h2 className="mt-1 text-3xl font-bold">
            Influencer Management
          </h2>

          <p className="mt-2 text-slate-600">
            인플루언서 DB와 캠페인 정보를 관리합니다.
          </p>
        </section>

        {/* 통계 */}
        <section className="mb-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border-2 border-slate-400 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              등록 인플루언서
            </p>

            <p className="mt-2 text-3xl font-bold">
              {(influencerCount ?? 0).toLocaleString()}
              <span className="ml-1 text-lg font-medium text-slate-500">
                명
              </span>
            </p>
          </div>

          <div className="rounded-xl border-2 border-slate-400 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              등록 캠페인
            </p>

            <p className="mt-2 text-3xl font-bold">
              {(campaignCount ?? 0).toLocaleString()}
              <span className="ml-1 text-lg font-medium text-slate-500">
                개
              </span>
            </p>
          </div>
        </section>

        {/* 메뉴 */}
        <section>
          <h3 className="mb-4 text-lg font-bold">
            빠른 메뉴
          </h3>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Influencer DB */}
            <Link
              href="/influencers"
              className="group rounded-xl border-2 border-slate-500 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white">
                DB
              </div>

              <h4 className="text-lg font-bold">
                인플루언서 DB
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                등록된 인플루언서를 검색하고
                상세 정보와 협업 이력을 확인합니다.
              </p>

              <p className="mt-5 text-sm font-semibold text-slate-900">
                DB 열기 →
              </p>
            </Link>

            {/* Excel */}
            <Link
              href="/influencers/import"
              className="group rounded-xl border-2 border-slate-500 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-700 bg-slate-100 text-sm font-bold">
                XLS
              </div>

              <h4 className="text-lg font-bold">
                Excel 업로드
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                기존 인플루언서 리스트를 Excel에서
                읽어 DB에 일괄 반영합니다.
              </p>

              <p className="mt-5 text-sm font-semibold text-slate-900">
                Excel 업로드 →
              </p>
            </Link>

            {/* Add */}
            <Link
              href="/influencers/new"
              className="group rounded-xl border-2 border-slate-500 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-slate-700 bg-slate-100 text-xl font-bold">
                +
              </div>

              <h4 className="text-lg font-bold">
                인플루언서 추가
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                새로운 인플루언서를 직접 등록하고
                정보를 입력합니다.
              </p>

              <p className="mt-5 text-sm font-semibold text-slate-900">
                새로 추가 →
              </p>
            </Link>
          </div>
        </section>

        {/* 캠페인 */}
        <section className="mt-8 rounded-xl border-2 border-slate-400 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">
                캠페인 관리
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                캠페인 생성 및 인플루언서 제안 현황 관리는
                다음 단계에서 연결합니다.
              </p>
            </div>

            <Link
              href="/campaigns"
              className="rounded-lg border-2 border-slate-500 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              캠페인 →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}