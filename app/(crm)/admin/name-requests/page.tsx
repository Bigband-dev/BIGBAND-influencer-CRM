import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/roles";
import NameRequestManager from "@/components/name-request-manager";

export const instant = false;

export default async function AdminNameRequestsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: currentProfile,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    !isAdmin(
      currentProfile?.role
    )
  ) {
    redirect("/influencers");
  }

  const {
    data: requests,
    error,
  } = await supabase
    .from(
      "name_change_requests"
    )
    .select(`
      id,
      user_id,
      current_name,
      requested_name,
      status,
      requested_at,
      reviewed_at,
      admin_note,
      profiles:user_id (
        email,
        name
      )
    `)
    .order("requested_at", {
      ascending: false,
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
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          이름 변경 요청
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          사용자의 이름 변경 요청을
          승인하거나 거절합니다.
        </p>
      </div>

      <NameRequestManager
        requests={
          requests ?? []
        }
      />
    </div>
  );
}