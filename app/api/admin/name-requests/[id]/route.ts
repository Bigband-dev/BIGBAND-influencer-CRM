import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/roles";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } =
      await context.params;

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "로그인이 필요합니다.",
        },
        { status: 401 }
      );
    }

    const {
      data: adminProfile,
    } = await supabase
      .from("profiles")
      .select("role, name, email")
      .eq("id", user.id)
      .single();

    if (
      !isAdmin(
        adminProfile?.role
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const action =
      body.action;

    const adminNote =
      String(
        body.adminNote || ""
      ).trim();

    if (
      action !== "approve" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "잘못된 요청입니다.",
        },
        { status: 400 }
      );
    }

    const {
      data: nameRequest,
    } = await supabase
      .from(
        "name_change_requests"
      )
      .select(
        "id, user_id, current_name, requested_name, status"
      )
      .eq("id", id)
      .single();

    if (!nameRequest) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "요청을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (
      nameRequest.status !==
      "pending"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "이미 처리된 요청입니다.",
        },
        { status: 409 }
      );
    }

    if (action === "approve") {
      const { error:
        profileUpdateError } =
        await supabase
          .from("profiles")
          .update({
            name:
              nameRequest.requested_name,
          })
          .eq(
            "id",
            nameRequest.user_id
          );

      if (
        profileUpdateError
      ) {
        console.error(
          "Profile name update:",
          profileUpdateError
        );

        return NextResponse.json(
          {
            ok: false,
            message:
              "사용자 이름 변경에 실패했습니다.",
          },
          { status: 500 }
        );
      }
    }

    const { error:
      requestUpdateError } =
      await supabase
        .from(
          "name_change_requests"
        )
        .update({
          status:
            action === "approve"
              ? "approved"
              : "rejected",

          reviewed_at:
            new Date().toISOString(),

          reviewed_by:
            user.id,

          admin_note:
            adminNote || null,
        })
        .eq("id", id);

    if (
      requestUpdateError
    ) {
      console.error(
        "Request update:",
        requestUpdateError
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "요청 상태 변경에 실패했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Admin name request:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}