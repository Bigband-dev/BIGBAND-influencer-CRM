import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/roles";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message: "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!isAdmin(currentProfile?.role)) {
      return NextResponse.json(
        {
          ok: false,
          message: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    if (id === user.id) {
      return NextResponse.json(
        {
          ok: false,
          message: "자기 자신의 계정은 삭제할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const { data: targetUser } = await supabase
      .from("profiles")
      .select("id, role, is_active, email")
      .eq("id", id)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          message: "사용자를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (targetUser.role === "owner") {
      return NextResponse.json(
        {
          ok: false,
          message: "Owner 계정은 삭제할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    if (targetUser.is_active) {
      return NextResponse.json(
        {
          ok: false,
          message: "활성 계정은 삭제할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete profile error:", error);

      return NextResponse.json(
        {
          ok: false,
          message: "계정 삭제에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "계정 삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}