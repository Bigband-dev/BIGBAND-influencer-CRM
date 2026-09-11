import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignEditForm from "@/components/campaign-edit-form";

export const instant = false;

export default async function CampaignEditPage({
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

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          캠페인 수정
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          캠페인의 기본 정보를 수정합니다.
        </p>
      </div>

      <CampaignEditForm
        campaign={campaign}
      />
    </div>
  );
}