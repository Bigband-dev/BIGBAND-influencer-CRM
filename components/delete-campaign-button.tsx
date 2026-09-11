"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteCampaignButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [deleting, setDeleting] =
    useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `"${campaignName}" 캠페인을 삭제하시겠습니까?\n\n연결된 인플루언서의 캠페인 진행 이력도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);

    setDeleting(false);

    if (error) {
      alert(
        `캠페인 삭제 실패: ${error.message}`
      );
      return;
    }

    router.push("/campaigns");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
    >
      {deleting ? "삭제 중..." : "삭제"}
    </button>
  );
}