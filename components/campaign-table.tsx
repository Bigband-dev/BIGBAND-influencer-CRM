"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPriceMan } from "@/lib/format-number";

type Campaign = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  description: string | null;

  purpose: string | null;
  platforms: string[] | null;
  budget: number | null;

  start_date: string | null;
  end_date: string | null;
  status: string | null;
  created_at: string | null;

  campaign_influencers?: {
    id: string;
    status: string | null;
  }[];
};

export default function CampaignTable({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filteredCampaigns = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return campaigns.filter((campaign) => {
      const searchMatch =
        !keyword ||
        campaign.name?.toLowerCase().includes(keyword) ||
        campaign.brand?.toLowerCase().includes(keyword) ||
        campaign.product?.toLowerCase().includes(keyword);

      const statusMatch =
        status === "all" ||
        campaign.status === status;

      return searchMatch && statusMatch;
    });
  }, [campaigns, search, status]);

  const ongoingCount = campaigns.filter(
    (campaign) =>
      campaign.status === "ongoing" ||
      campaign.status === "in_progress"
  ).length;

  const completedCount = campaigns.filter(
    (campaign) =>
      campaign.status === "completed"
  ).length;

  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* 통계 */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            전체 캠페인
          </p>

          <p className="mt-1 text-2xl font-bold">
            {campaigns.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            진행 중
          </p>

          <p className="mt-1 text-2xl font-bold">
            {ongoingCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            진행 완료
          </p>

          <p className="mt-1 text-2xl font-bold">
            {completedCount}
          </p>
        </div>
      </div>

      {/* 검색/필터 */}
      <section className="rounded-2xl border border-slate-500 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="캠페인명, 광고주, 제품명 검색"
            className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-sm"
          />

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
            className="rounded-lg border border-slate-400 bg-white px-4 py-2.5 text-sm"
          >
            <option value="all">
              전체 상태
            </option>

            <option value="planning">
              준비 중
            </option>

            <option value="ongoing">
              진행 중
            </option>

            <option value="completed">
              진행 완료
            </option>

            <option value="cancelled">
              취소
            </option>
          </select>
        </div>
      </section>

      {/* 목록 */}
      <section className="overflow-hidden rounded-2xl border border-slate-500 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-100 text-slate-700">
            <tr>
              <th className="px-5 py-4 text-left">
                캠페인명
              </th>

              <th className="px-5 py-4 text-left">
                광고주
              </th>

              <th className="px-5 py-4 text-left">
                제품
              </th>

              <th className="px-5 py-4 text-left">
                기간
              </th>

              <th className="px-5 py-4 text-center">
                상태
              </th>

              <th className="px-5 py-4 text-right">
                예산
              </th>

              <th className="px-5 py-4 text-center">
                후보
              </th>

              <th className="px-5 py-4 text-center">
                확정
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {filteredCampaigns.map((campaign) => {
                const candidateCount =
                  campaign.campaign_influencers?.length ?? 0;
                  
                const confirmedCount = 
                  campaign.campaign_influencers?.filter(
                    (influencer) => influencer.status === "confirmed"
                  ).length ?? 0;

                return (
                  <tr
                    key={campaign.id}
                    onClick={() =>
                      router.push(`/campaigns/${campaign.id}`)
                  }
                  className="cursor-pointer transition hover:bg-slate-100"
                >
                  <td className="px-5 py-4 font-semibold">
                    {campaign.name}
                  </td>

                  <td className="px-5 py-4">
                    {campaign.brand || "-"}
                  </td>

                  <td className="px-5 py-4">
                    {campaign.product || "-"}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {campaign.start_date || "-"}
                    {" ~ "}
                    {campaign.end_date || "-"}
                  </td>

                  <td className="px-5 py-4 text-center">
                    <StatusBadge
                      status={campaign.status}
                    />
                  </td>

                  <td className="px-5 py-4 text-right">
                    {formatPriceMan(campaign.budget)}
                  </td>

                  <td className="px-5 py-4 text-center">
                    {candidateCount}명
                  </td>

                  <td className="px-5 py-4 text-center">
                    {confirmedCount}명
                  </td>
                </tr>
              )
            })}

            {filteredCampaigns.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-16 text-center text-slate-400"
                >
                  조건에 맞는 캠페인이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string | null;
}) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    planning: {
      label: "준비 중",
      className:
        "border-amber-300 bg-amber-50 text-amber-700",
    },

    ongoing: {
      label: "진행 중",
      className:
        "border-blue-300 bg-blue-50 text-blue-700",
    },

    in_progress: {
      label: "진행 중",
      className:
        "border-blue-300 bg-blue-50 text-blue-700",
    },

    completed: {
      label: "진행 완료",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-700",
    },

    cancelled: {
      label: "진행 중단",
      className:
        "border-red-300 bg-red-50 text-red-700",
    },
  };

  const current =
    status && config[status]
      ? config[status]
      : {
          label: status || "-",
          className:
            "border-slate-300 bg-slate-100 text-slate-600",
        };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  );
}