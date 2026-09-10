import { createClient } from "@/lib/supabase/server";
import CampaignTable from "@/components/campaign-table";
import Link from "next/link";

export const instant = false;

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-8">
        <h1 className="text-2xl font-bold">
          캠페인 조회 오류
        </h1>

        <p className="mt-4 text-red-600">
          {error.message}
        </p>
      </div>
    );
  }

    return (
    <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">
            캠페인 목록
            </h1>
        </div>

        <Link
            href="/campaigns/new"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
            + 캠페인 생성
        </Link>
        </div>

        <CampaignTable campaigns={campaigns ?? []} />
    </div>
    );
}