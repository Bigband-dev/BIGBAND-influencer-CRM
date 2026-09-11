import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import DeleteCampaignButton from "@/components/delete-campaign-button";

import CampaignInfluencerManager
  from "@/components/campaign-influencer-manager";

export const instant = false;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data: campaign, error } =
    await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

  if (error || !campaign) {
    notFound();
  }

  const { data: influencers } =
    await supabase
      .from("influencers")
      .select(`
        id,
        name,
        instagram_id,
        followers,
        avg_views,
        category,
        collaboration_rate
      `)
      .order("followers", {
        ascending: false,
      });

  const { data: campaignInfluencers } =
    await supabase
      .from("campaign_influencers")
      .select(`
        id,
        influencer_id,
        status,
        proposed_rate,
        final_rate,
        memo,
        influencers (
          id,
          name,
          instagram_id,
          followers,
          avg_views,
          category,
          collaboration_rate
        )
      `)
      .eq("campaign_id", id);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mt-1 text-3xl font-bold">
            {campaign.name}
          </h1>

          <p className="mt-2 text-slate-500">
            {"광고주 : " + (campaign.brand || "-")}

            {campaign.product
              ? ` / 제품 : ${campaign.product}`
              : ""}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className="rounded-lg border-2 border-slate-400 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            수정
          </Link>

          <DeleteCampaignButton
            campaignId={campaign.id}
            campaignName={campaign.name}
          />
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <InfoCard
          label="상태"
          value={campaign.status}
        />

        <InfoCard
          label="시작일"
          value={campaign.start_date || "-"}
        />

        {/* 나머지 InfoCard */}
      </section>

      <CampaignInfluencerManager
        campaignId={id}
        influencers={influencers ?? []}
        campaignInfluencers={
          campaignInfluencers ?? []
        }
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border-2 border-slate-400 bg-white p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}