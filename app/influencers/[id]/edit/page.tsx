import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import InfluencerForm from "@/components/influencer-form";

export const instant = false;

export default async function EditInfluencerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: influencer, error } =
    await supabase
      .from("influencers")
      .select("*")
      .eq("id", id)
      .single();

  if (error || !influencer) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href={`/influencers/${id}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← 상세 페이지
        </Link>

        <div className="mb-8 mt-5">
          <p className="text-sm font-medium text-slate-500">
            Influencer Management
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            인플루언서 수정
          </h1>
        </div>

        <InfluencerForm
          initialData={influencer}
        />
      </div>
    </main>
  );
}