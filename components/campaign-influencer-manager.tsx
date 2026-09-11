"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMan } from "@/lib/format-number";

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
  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);
  const [adding, setAdding] = useState(false);

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
    const keyword =
      search.toLowerCase().trim();

    return influencers.filter((item) => {
      if (existingIds.has(item.id)) {
        return false;
      }

      if (!keyword) return true;

      return (
        item.name
          ?.toLowerCase()
          .includes(keyword) ||
        item.instagram_id
          .toLowerCase()
          .includes(keyword) ||
        item.category
          ?.toLowerCase()
          .includes(keyword)
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

    const rows = selectedIds.map(
      (influencerId) => ({
        campaign_id: campaignId,
        influencer_id: influencerId,
        status: "candidate",
      })
    );

    const { error } = await supabase
      .from("campaign_influencers")
      .upsert(rows, {
        onConflict:
          "campaign_id,influencer_id",
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
      `"${influencerName}" 인플루언서를 이 캠페인에서 제거하시겠습니까?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("campaign_influencers")
      .delete()
      .eq("id", campaignInfluencerId);

    if (error) {
      alert(
        `캠페인에서 제거 실패: ${error.message}`
      );
      return;
    }

    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 현재 캠페인 인플루언서 */}
      <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
        <div className="border-b-2 border-slate-400 px-6 py-5">
          <h2 className="text-lg font-bold">
            캠페인 인플루언서
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            현재 캠페인에 등록된 인플루언서입니다.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-5 py-3 text-left">
                이름
              </th>

              <th className="px-5 py-3 text-left">
                Instagram
              </th>

              <th className="px-5 py-3 text-left">
                카테고리
              </th>

              <th className="px-5 py-3 text-right">
                팔로워
              </th>

              <th className="px-5 py-3 text-center">
                진행 상태
              </th>

              <th className="px-5 py-3 text-center">
                관리
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {campaignInfluencers.map(
              (item) => {
                const influencer =
                  Array.isArray(
                    item.influencers
                  )
                    ? item.influencers[0]
                    : item.influencers;

                if (!influencer) {
                  return null;
                }

                return (
                  <tr key={item.id}>
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
                      {formatMan(
                        influencer.followers
                      )}
                    </td>

                    <td className="px-5 py-4 text-center">
                      {item.status || "candidate"}
                    </td>

                    <td className="px-5 py-4 text-center">
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
              }
            )}

            {!campaignInfluencers.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  아직 등록된 인플루언서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* DB에서 추가 */}
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
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="이름, Instagram ID, 카테고리 검색"
          className="mb-4 w-full rounded-lg border-2 border-slate-300 px-4 py-2.5"
        />

        <div className="max-h-[450px] overflow-auto border border-slate-300">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-300">
              {availableInfluencers.map(
                (influencer) => (
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
                          toggle(
                            influencer.id
                          )
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
                      {formatMan(
                        influencer.followers
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}