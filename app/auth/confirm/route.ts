import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/")
      ? rawNext
      : "/influencers";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.search = "";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }

    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/login";
    errorUrl.search = "";
    errorUrl.searchParams.set(
      "error",
      "email-confirmation-failed"
    );

    return NextResponse.redirect(errorUrl);
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login";
  errorUrl.search = "";
  errorUrl.searchParams.set(
    "error",
    "invalid-confirmation-link"
  );

  return NextResponse.redirect(errorUrl);
}
