import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { connected: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gmail_connections")
    .select("google_email, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { connected: false, error: `Gmail 연결 상태 조회 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    connected: Boolean(data?.google_email),
    email: data?.google_email ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}
