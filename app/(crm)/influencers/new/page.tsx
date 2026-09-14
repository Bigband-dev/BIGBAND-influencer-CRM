import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InfluencerForm from "@/components/influencer-form";

export const instant = false;

export default async function NewInfluencerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/influencers"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← 인플루언서 목록
        </Link>

        <div className="mb-8 mt-5">
          <h1 className="mt-1 text-3xl font-bold">
            인플루언서 추가
          </h1>
        </div>

        <InfluencerForm />
      </div>
    </main>
  );
}