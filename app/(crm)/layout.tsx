import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

export const instant = false;

export default async function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        userEmail={profile?.email ?? user.email ?? ""}
        userName={profile?.name ?? ""}
        role={profile?.role ?? "member"}
      />

      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}