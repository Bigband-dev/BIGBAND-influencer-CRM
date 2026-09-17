import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserRoleManager from "@/components/user-role-manager";
import { isAdmin } from "@/lib/auth/roles";

export const instant = false;

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 현재 로그인한 사용자의 권한 확인
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // admin / owner만 접근 가능
  if (!isAdmin(currentProfile?.role)) {
    redirect("/influencers");
  }

  // 전체 사용자 조회
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(
      "id, name, email, role, is_active, created_at"
    )
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <p className="text-red-600">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          사용자 관리
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          팀원의 권한, 계정 상태를 관리합니다.
        </p>
      </div>

      <UserRoleManager
        users={profiles ?? []}
        currentUserId={user.id}
        currentUserRole={
          currentProfile?.role ?? "member"
        }
      />
    </div>
  );
}