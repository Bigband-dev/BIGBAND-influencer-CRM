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

  /*
   * 인플루언서 기본 정보 +
   * 연결된 모든 채널 정보 조회
   */
  const { data: influencer, error } =
    await supabase
      .from("influencers")
      .select(`
        *,
        channels:influencer_channels (
          id,
          influencer_id,
          platform,
          channel_name,
          handle,
          url,
          followers,
          avg_views,
          is_primary,
          memo
        )
      `)
      .eq("id", id)
      .single();

  if (error || !influencer) {
    notFound();
  }

  /*
   * 대표 채널을 앞쪽으로 정렬
   * 수정 폼에서도 대표 채널을 먼저 보여주기 위함
   */
  const sortedChannels = [
    ...(influencer.channels ?? []),
  ].sort((a, b) => {
    if (a.is_primary && !b.is_primary) {
      return -1;
    }

    if (!a.is_primary && b.is_primary) {
      return 1;
    }

    return 0;
  });

  const initialData = {
    ...influencer,
    channels: sortedChannels,
  };

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
          <h1 className="mt-1 text-3xl font-bold">
            인플루언서 수정
          </h1>
        </div>

        <InfluencerForm
          initialData={initialData}
        />
      </div>
    </main>
  );
}