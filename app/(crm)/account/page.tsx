import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NameChangeRequestForm from "@/components/name-change-request-form";

export const instant = false;

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/influencers");
  }

  const { data: pendingRequest } = await supabase
    .from("name_change_requests")
    .select(
      "id, current_name, requested_name, status, requested_at, admin_note"
    )
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          내 계정
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          계정 정보와 이름 변경 요청을 관리합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          계정 정보
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-500">
              이메일
            </div>

            <div className="mt-1 text-sm text-slate-900">
              {profile.email}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-500">
              현재 이름
            </div>

            <div className="mt-1 text-sm text-slate-900">
              {profile.name || "-"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <NameChangeRequestForm
          currentName={profile.name || ""}
          pendingRequest={pendingRequest}
        />
      </div>
    </div>
  );
}