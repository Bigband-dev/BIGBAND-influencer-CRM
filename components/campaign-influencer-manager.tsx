"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMan } from "@/lib/format-number";
import { CAMPAIGN_INFLUENCER_STATUS } from "@/lib/campaign-status";

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

const STATUS_ENTRIES = Object.entries(CAMPAIGN_INFLUENCER_STATUS);

function normalizeStatusLabel(label: unknown) {
  return String(label ?? "").replace(/\s/g, "");
}

function isConfirmedStatus(status: string | null) {
  const contactedIndex = STATUS_ENTRIES.findIndex(([, label]) =>
    normalizeStatusLabel(label).includes("컨택완료")
  );

  const statusIndex = STATUS_ENTRIES.findIndex(
    ([value]) => value === (status || "candidate")
  );

  if (contactedIndex >= 0 && statusIndex >= 0) {
    return statusIndex >= contactedIndex;
  }

  // campaign-status의 라벨 순서가 바뀌거나 "컨택완료" 라벨을 찾지 못했을 때의 fallback
  return [
    "contacted",
    "proposal_wait",
    "draft_wait",
    "final_wait",
    "confirmed",
    "completed",
  ].includes(status || "");
}

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
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  const [pageSize, setPageSize] = useState(50);
  const [candidatePage, setCandidatePage] = useState(1);
  const [confirmedPage, setConfirmedPage] = useState(1);
  const [availablePage, setAvailablePage] = useState(1);

  const existingIds = useMemo(
    () => new Set(campaignInfluencers.map((item) => item.influencer_id)),
    [campaignInfluencers]
  );

  const candidateInfluencers = useMemo(
    () => campaignInfluencers.filter((item) => !isConfirmedStatus(item.status)),
    [campaignInfluencers]
  );

  const confirmedInfluencers = useMemo(
    () => campaignInfluencers.filter((item) => isConfirmedStatus(item.status)),
    [campaignInfluencers]
  );

  const availableInfluencers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return influencers.filter((item) => {
      if (existingIds.has(item.id)) return false;
      if (!keyword) return true;

      return (
        item.name?.toLowerCase().includes(keyword) ||
        item.instagram_id?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword)
      );
    });
  }, [influencers, existingIds, search]);

  const paginate = <T,>(items: T[], page: number) => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  const candidateTotalPages = Math.max(
    1,
    Math.ceil(candidateInfluencers.length / pageSize)
  );
  const confirmedTotalPages = Math.max(
    1,
    Math.ceil(confirmedInfluencers.length / pageSize)
  );
  const availableTotalPages = Math.max(
    1,
    Math.ceil(availableInfluencers.length / pageSize)
  );

  const paginatedCandidates = useMemo(
    () => paginate(candidateInfluencers, candidatePage),
    [candidateInfluencers, candidatePage, pageSize]
  );

  const paginatedConfirmed = useMemo(
    () => paginate(confirmedInfluencers, confirmedPage),
    [confirmedInfluencers, confirmedPage, pageSize]
  );

  const paginatedAvailable = useMemo(
    () => paginate(availableInfluencers, availablePage),
    [availableInfluencers, availablePage, pageSize]
  );

  useEffect(() => {
    setAvailablePage(1);
  }, [search, pageSize]);

  useEffect(() => {
    setCandidatePage((page) =>
      Math.min(page, candidateTotalPages)
    );
  }, [candidateTotalPages]);

  useEffect(() => {
    setConfirmedPage((page) =>
      Math.min(page, confirmedTotalPages)
    );
  }, [confirmedTotalPages]);

  useEffect(() => {
    setAvailablePage((page) =>
      Math.min(page, availableTotalPages)
    );
  }, [availableTotalPages]);

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
      .upsert(rows, { onConflict: "campaign_id,influencer_id" });

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

  const toggleCampaignInfluencer = (campaignInfluencerId: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(campaignInfluencerId)
        ? prev.filter((id) => id !== campaignInfluencerId)
        : [...prev, campaignInfluencerId]
    );
  };

  const areAllSelected = (items: CampaignInfluencer[]) =>
    items.length > 0 &&
    items.every((item) => selectedCampaignIds.includes(item.id));

  const toggleAll = (items: CampaignInfluencer[]) => {
    const ids = items.map((item) => item.id);

    if (areAllSelected(items)) {
      setSelectedCampaignIds((prev) =>
        prev.filter((id) => !ids.includes(id))
      );
      return;
    }

    setSelectedCampaignIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleBulkRemove = async () => {
    if (selectedCampaignIds.length === 0 || removing) return;

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
      .update({ status })
      .eq("id", campaignInfluencerId);

    if (error) {
      alert(`상태 변경 실패: ${error.message}`);
      return;
    }

    router.refresh();
  };

  const renderPagination = (
    totalItems: number,
    page: number,
    setPage: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const totalPages = Math.max(
      1,
      Math.ceil(totalItems / pageSize)
    );

    if (totalItems === 0) return null;

    return (
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {((page - 1) * pageSize + 1).toLocaleString()}-
          {Math.min(
            page * pageSize,
            totalItems
          ).toLocaleString()}
          명 / 총 {totalItems.toLocaleString()}명
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPage((prev) => Math.max(1, prev - 1))
            }
            disabled={page === 1}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>

          <span className="min-w-[90px] text-center text-sm text-slate-600">
            {page.toLocaleString()} / {totalPages.toLocaleString()}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((prev) =>
                Math.min(totalPages, prev + 1)
              )
            }
            disabled={page === totalPages}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    );
  };

  const renderCampaignTable = (
    title: string,
    description: string,
    items: CampaignInfluencer[],
    pageItems: CampaignInfluencer[],
    page: number,
    setPage: React.Dispatch<React.SetStateAction<number>>,
    confirmed = false
  ) => (
    <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
      <div className="flex items-center justify-between border-b-2 border-slate-400 px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{title}</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                confirmed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {items.length}명
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {selectedCampaignIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCampaignIds([])}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              선택 해제
            </button>
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
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="w-12 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={areAllSelected(pageItems)}
                  onChange={() => toggleAll(pageItems)}
                  aria-label={`${title} 전체 선택`}
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
            {pageItems.map((item) => {
              const influencer = Array.isArray(item.influencers)
                ? item.influencers[0]
                : item.influencers;

              if (!influencer) return null;

              return (
                <tr
                  key={item.id}
                  onClick={() =>
                    router.push(`/influencers/${influencer.id}`)
                  }
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td
                    className="w-12 px-4 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.includes(item.id)}
                      onChange={() => toggleCampaignInfluencer(item.id)}
                      aria-label={`${
                        influencer.name || influencer.instagram_id
                      } 선택`}
                    />
                  </td>

                  <td className="px-5 py-4 font-semibold">
                    {influencer.name || "-"}
                  </td>

                  <td className="px-5 py-4">
                    {influencer.instagram_id
                      ? `@${influencer.instagram_id}`
                      : "-"}
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
                        handleStatusChange(item.id, e.target.value)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {STATUS_ENTRIES.map(([value, label]) => (
                        <option key={value} value={value}>
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
                          influencer.name || influencer.instagram_id
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

            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-slate-400"
                >
                  {confirmed
                    ? "컨택완료 이후 단계의 확정 인원이 없습니다."
                    : "현재 후보 인원이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renderPagination(
        items.length,
        page,
        setPage
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      {renderCampaignTable(
        "후보 인원",
        "컨택완료 이전 단계의 캠페인 후보입니다.",
        candidateInfluencers,
        paginatedCandidates,
        candidatePage,
        setCandidatePage
      )}

      {renderCampaignTable(
        "확정 인원",
        "컨택완료 및 그 이후 단계의 인플루언서입니다.",
        confirmedInfluencers,
        paginatedConfirmed,
        confirmedPage,
        setConfirmedPage,
        true
      )}

      <section className="rounded-xl border-2 border-slate-400 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">DB에서 인플루언서 추가</h2>
            <p className="mt-1 text-sm text-slate-500">
              기존 인플루언서 DB에서 캠페인 후보를 선택합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) =>
                setPageSize(Number(e.target.value))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700"
              aria-label="페이지당 표시 개수"
            >
              <option value={25}>25명씩 보기</option>
              <option value={50}>50명씩 보기</option>
              <option value={100}>100명씩 보기</option>
            </select>

            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || selectedIds.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {adding ? "추가 중..." : `${selectedIds.length}명 추가`}
            </button>
          </div>
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
              {paginatedAvailable.map((influencer) => (
                <tr key={influencer.id} className="hover:bg-slate-50">
                  <td className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(influencer.id)}
                      onChange={() => toggle(influencer.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {influencer.name || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {influencer.instagram_id
                      ? `@${influencer.instagram_id}`
                      : "-"}
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

        {renderPagination(
          availableInfluencers.length,
          availablePage,
          setAvailablePage
        )}
      </section>
    </div>
  );
}
