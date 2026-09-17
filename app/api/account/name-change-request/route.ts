import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
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

    const body =
      await request.json();

    const requestedName =
      String(
        body.requestedName || ""
      ).trim();

    if (!requestedName) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "변경할 이름을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    if (
      requestedName.length > 50
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "이름은 50자 이하로 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "사용자 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    if (
      requestedName ===
      profile.name
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "현재 이름과 동일합니다.",
        },
        { status: 400 }
      );
    }

    const { data: existing } =
      await supabase
        .from(
          "name_change_requests"
        )
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "이미 승인 대기 중인 요청이 있습니다.",
        },
        { status: 409 }
      );
    }

    const { error } =
      await supabase
        .from(
          "name_change_requests"
        )
        .insert({
          user_id: user.id,
          current_name:
            profile.name,
          requested_name:
            requestedName,
          status: "pending",
        });

    if (error) {
      console.error(
        "Name request insert:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          message:
            "이름 변경 요청을 저장하지 못했습니다.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Name change request:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message:
          "요청 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}