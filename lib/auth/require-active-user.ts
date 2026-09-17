import { createClient } from "@/lib/supabase/server";

export async function getActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      supabase,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    return {
      user: null,
      profile: null,
      supabase,
    };
  }

  return {
    user,
    profile,
    supabase,
  };
}