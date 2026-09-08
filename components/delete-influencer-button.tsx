"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteInfluencerButton({
  influencerId,
  influencerName,
}: {
  influencerId: string;
  influencerName: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `${influencerName} 인플루언서를 삭제하시겠습니까?\n\n관련 캠페인 연결 정보도 함께 삭제될 수 있습니다.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("influencers")
      .delete()
      .eq("id", influencerId);

    setLoading(false);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }

    router.push("/influencers");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border-2 border-red-500 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? "삭제 중..." : "삭제"}
    </button>
  );
}