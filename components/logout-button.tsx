"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm border rounded-lg px-4 py-2
      color-slate-700 border-slate-500 bg-white hover:bg-slate-50"
    >
      로그아웃
    </button>
  );
}