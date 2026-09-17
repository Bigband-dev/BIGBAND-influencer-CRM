import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/roles";

export const instant = false;

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isAdmin(currentProfile?.role)) {
    redirect("/influencers");
  }

  const [
    usersResult,
    activeUsersResult,
    pendingRequestsResult,
    influencersResult,
    campaignsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("is_active", true),

    supabase
      .from("name_change_requests")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "pending"),

    supabase
      .from("influencers")
      .select("*", {
        count: "exact",
        head: true,
      }),

    supabase
      .from("campaigns")
      .select("*", {
        count: "exact",
        head: true,
      }),
  ]);

  const totalUsers =
    usersResult.count ?? 0;

  const activeUsers =
    activeUsersResult.count ?? 0;

  const inactiveUsers =
    Math.max(0, totalUsers - activeUsers);

  const pendingRequests =
    pendingRequestsResult.count ?? 0;

  const influencerCount =
    influencersResult.count ?? 0;

  const campaignCount =
    campaignsResult.count ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          관리자 메뉴
        </h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          title="전체 사용자"
          value={totalUsers}
          description={`활성 ${activeUsers} · 비활성 ${inactiveUsers}`}
        />

        <AdminStatCard
          title="이름 변경 요청"
          value={pendingRequests}
          description="승인 대기"
          href="/admin/name-requests"
        />

        <AdminStatCard
          title="인플루언서"
          value={influencerCount}
          description="등록된 계정"
          href="/influencers"
        />

        <AdminStatCard
          title="캠페인"
          value={campaignCount}
          description="등록된 캠페인"
          href="/campaigns"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-300 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">
            사용자 관리
          </h2>

          <div className="mt-4 space-y-3">
            <AdminMenu
              href="/admin/users"
              title="사용자 관리"
              description="사용자 권한과 활성 상태를 관리합니다."
            />

            <AdminMenu
              href="/admin/name-requests"
              title="이름 변경 요청"
              description={`${pendingRequests}건의 요청이 대기 중입니다.`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({
  title,
  value,
  description,
  href,
}: {
  title: string;
  value: number;
  description: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-slate-300 bg-white p-6">
      <div className="text-sm font-semibold text-slate-600">
        {title}
      </div>

      <div className="mt-3 text-3xl font-bold text-slate-900">
        {value.toLocaleString()}
      </div>

      <div className="mt-2 text-sm text-slate-500">
        {description}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href}>
      {content}
    </Link>
  );
}

function AdminMenu({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-300 px-4 py-4 hover:bg-slate-50"
    >
      <div className="font-semibold text-slate-900">
        {title}
      </div>

      <div className="mt-1 text-sm text-slate-500">
        {description}
      </div>
    </Link>
  );
}