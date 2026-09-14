"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMan } from "@/lib/format-number";
import {
  CAMPAIGN_INFLUENCER_STATUS,
} from "@/lib/campaign-status";

type Influencer = {
  id: string;
  name: string | null;
  instagram_id: string;
  followers: number | null;
  avg_views: number | null;
  category: string | null;
  collaboration_rate: number | null;
};

type CampaignInfluencer = {
  id: string;
  influencer_id: string;
  status: string | null;
  proposed_rate: number | null;
  final_rate: number | null;
  memo: string | null;
  influencers: Influencer | Influencer[] | null;
};

export default function CampaignInfluencerManager({
  campaignId,
  influencers,
  campaignInfluencers,
}: {
  campaignId: string;
  influencers: Influencer[];
  campaignInfluencers: CampaignInfluencer[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const [selectedCampaignIds, setSelectedCampaignIds] =
    useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  const existingIds = useMemo(
    () =>
      new Set(
        campaignInfluencers.map(
          (item) => item.influencer_id
        )
      ),
    [campaignInfluencers]
  );

  const availableInfluencers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return influencers.filter((item) => {
      if (existingIds.has(item.id)) {
        return false;
      }

      if (!keyword) return true;

      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.instagram_id.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword)
      );
    });
  }, [influencers, existingIds, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (!selectedIds.length) return;

    setAdding(true);

    const rows = selectedIds.map((influencerId) => ({
      campaign_id: campaignId,
      influencer_id: influencerId,
      status: "candidate",
    }));

    const { error } = await supabase
      .from("campaign_influencers")
      .upsert(rows, {
        onConflict: "campaign_id,influencer_id",
      });

    setAdding(false);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedIds([]);
    router.refresh();
  };

  const handleRemove = async (
    campaignInfluencerId: string,
    influencerName: string
  ) => {
    const confirmed = window.confirm(
      `"${influencerName}" 인플루언서를 이 캠페인에서 제거하시겠습니까?\n\n인플루언서 DB 자체는 삭제되지 않고 캠페인 연결만 제거됩니다.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("campaign_influencers")
      .delete()
      .eq("id", campaignInfluencerId);

    if (error) {
      alert(`캠페인에서 제거 실패: ${error.message}`);
      return;
    }

    setSelectedCampaignIds((prev) =>
      prev.filter((id) => id !== campaignInfluencerId)
    );

    router.refresh();
  };

  const toggleCampaignInfluencer = (
    campaignInfluencerId: string
  ) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campaignInfluencerId)
        ? prev.filter((id) => id !== campaignInfluencerId)
        : [...prev, campaignInfluencerId]
    );
  };

  const allCampaignSelected =
    campaignInfluencers.length > 0 &&
    campaignInfluencers.every((item) =>
      selectedCampaignIds.includes(item.id)
    );

  const toggleAllCampaignInfluencers = () => {
    if (allCampaignSelected) {
      setSelectedCampaignIds([]);
    } else {
      setSelectedCampaignIds(
        campaignInfluencers.map((item) => item.id)
      );
    }
  };

  const handleBulkRemove = async () => {
    if (
      selectedCampaignIds.length === 0 ||
      removing
    ) {
      return;
    }

    const confirmed = window.confirm(
      `선택한 ${selectedCampaignIds.length}명의 인플루언서를 이 캠페인에서 제거하시겠습니까?\n\n인플루언서 DB 자체는 삭제되지 않고 캠페인 연결만 제거됩니다.`
    );

    if (!confirmed) return;

    setRemoving(true);

    const { error } = await supabase
      .from("campaign_influencers")
      .delete()
      .in("id", selectedCampaignIds);

    setRemoving(false);

    if (error) {
      alert(`일괄 제거 실패: ${error.message}`);
      return;
    }

    setSelectedCampaignIds([]);
    router.refresh();
  };

  const handleStatusChange = async (
    campaignInfluencerId: string,
    status: string
  ) => {
    const { error } = await supabase
      .from("campaign_influencers")
      .update({
        status,
      })
      .eq("id", campaignInfluencerId);

    if (error) {
      alert(`상태 변경 실패: ${error.message}`);
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
        <div className="flex items-center justify-between border-b-2 border-slate-400 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold">
              캠페인 인플루언서
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              현재 캠페인에 등록된 인플루언서입니다.
            </p>
          </div>

          {selectedCampaignIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkRemove}
              disabled={removing}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {removing
                ? "제거 중..."
                : `선택 ${selectedCampaignIds.length}명 제거`}
            </button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="w-12 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allCampaignSelected}
                  onChange={toggleAllCampaignInfluencers}
                  aria-label="전체 선택"
                />
              </th>

              <th className="px-5 py-3 text-left">이름</th>
              <th className="px-5 py-3 text-left">Instagram</th>
              <th className="px-5 py-3 text-left">카테고리</th>
              <th className="px-5 py-3 text-right">팔로워</th>
              <th className="px-5 py-3 text-center">진행 상태</th>
              <th className="px-5 py-3 text-center">관리</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {campaignInfluencers.map((item) => {
              const influencer = Array.isArray(item.influencers)
                ? item.influencers[0]
                : item.influencers;

              if (!influencer) {
                return null;
              }

              return (
                <tr
                  key={item.id}
                  onClick={() =>
                    router.push(
                      `/influencers/${influencer.id}`
                    )
                  }
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td
                    className="w-12 px-4 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.includes(
                        item.id
                      )}
                      onChange={() =>
                        toggleCampaignInfluencer(item.id)
                      }
                      aria-label={`${
                        influencer.name ||
                        influencer.instagram_id
                      } 선택`}
                    />
                  </td>

                  <td className="px-5 py-4 font-semibold">
                    {influencer.name || "-"}
                  </td>

                  <td className="px-5 py-4">
                    @{influencer.instagram_id}
                  </td>

                  <td className="px-5 py-4">
                    {influencer.category || "-"}
                  </td>

                  <td className="px-5 py-4 text-right">
                    {formatMan(influencer.followers)}
                  </td>

                  <td
                    className="px-5 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={item.status || "candidate"}
                      onChange={(e) =>
                        handleStatusChange(
                          item.id,
                          e.target.value
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {Object.entries(
                        CAMPAIGN_INFLUENCER_STATUS
                      ).map(([value, label]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td
                    className="px-5 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleRemove(
                          item.id,
                          influencer.name ||
                            influencer.instagram_id
                        )
                      }
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      제거
                    </button>
                  </td>
                </tr>
              );
            })}

            {!campaignInfluencers.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  아직 등록된 인플루언서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border-2 border-slate-400 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              DB에서 인플루언서 추가
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              기존 인플루언서 DB에서 캠페인 후보를 선택합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={
              adding ||
              selectedIds.length === 0
            }
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {adding
              ? "추가 중..."
              : `${selectedIds.length}명 추가`}
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, Instagram ID, 카테고리 검색"
          className="mb-4 w-full rounded-lg border-2 border-slate-300 px-4 py-2.5"
        />

        <div className="max-h-[450px] overflow-auto border border-slate-300">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-300">
              {availableInfluencers.map((influencer) => (
                <tr
                  key={influencer.id}
                  className="hover:bg-slate-50"
                >
                  <td className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(
                        influencer.id
                      )}
                      onChange={() =>
                        toggle(influencer.id)
                      }
                    />
                  </td>

                  <td className="px-4 py-3 font-semibold">
                    {influencer.name || "-"}
                  </td>

                  <td className="px-4 py-3">
                    @{influencer.instagram_id}
                  </td>

                  <td className="px-4 py-3">
                    {influencer.category || "-"}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatMan(influencer.followers)}
                  </td>
                </tr>
              ))}

              {availableInfluencers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    추가 가능한 인플루언서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
