"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  formatMan,
  formatPriceMan,
} from "@/lib/format-number";

type Influencer = {
  id: string;
  name: string | null;
  instagram_id: string;
  instagram_url: string | null;
  email: string | null;

  followers: number | null;
  avg_views: number | null;

  category: string | null;
  subcategory: string | null;

  gender: string | null;
  age_group: string | null;

  collaboration_rate: number | null;

  memo: string | null;

  created_at: string | null;
};

type SortOption =
  | "followers_desc"
  | "followers_asc"
  | "views_desc"
  | "rate_desc"
  | "recent";

export default function InfluencerTable({
  influencers,
}: {
  influencers: Influencer[];
}) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [sort, setSort] = useState<SortOption>("followers_desc");

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);
  const [deleting, setDeleting] =
    useState(false);

  const categories = useMemo(() => {
    const values = influencers
      .map((item) => item.category)
      .filter((value): value is string => Boolean(value));

    return [...new Set(values)].sort();
  }, [influencers]);

  const filteredInfluencers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    const min = minFollowers ? Number(minFollowers) : null;
    const max = maxFollowers ? Number(maxFollowers) : null;

    const result = influencers.filter((influencer) => {
      const searchMatch =
        !keyword ||
        influencer.name?.toLowerCase().includes(keyword) ||
        influencer.instagram_id?.toLowerCase().includes(keyword) ||
        influencer.email?.toLowerCase().includes(keyword) ||
        influencer.category?.toLowerCase().includes(keyword);

      const categoryMatch =
        category === "all" || influencer.category === category;

      const followers = influencer.followers ?? 0;

      const minMatch = min === null || followers >= min;
      const maxMatch = max === null || followers <= max;

      return (
        searchMatch &&
        categoryMatch &&
        minMatch &&
        maxMatch
      );
    });

    result.sort((a, b) => {
      switch (sort) {
        case "followers_desc":
          return (b.followers ?? 0) - (a.followers ?? 0);

        case "followers_asc":
          return (a.followers ?? 0) - (b.followers ?? 0);

        case "views_desc":
          return (b.avg_views ?? 0) - (a.avg_views ?? 0);

        case "rate_desc":
          return (
            (b.collaboration_rate ?? 0) -
            (a.collaboration_rate ?? 0)
          );

        case "recent":
          return (
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
          );

        default:
          return 0;
      }
    });

    return result;
  }, [
    influencers,
    search,
    category,
    minFollowers,
    maxFollowers,
    sort,
  ]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setMinFollowers("");
    setMaxFollowers("");
    setSort("followers_desc");
  };
  const allVisibleSelected =
  filteredInfluencers.length > 0 &&
  filteredInfluencers.every((item) =>
    selectedIds.includes(item.id)
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredInfluencers.map(
      (item) => item.id
    );

    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter(
          (id) => !visibleIds.includes(id)
        )
      );
    } else {
      setSelectedIds((prev) => [
        ...new Set([...prev, ...visibleIds]),
      ]);
    }
  };

  const handleDeleteOne = async (
    id: string,
    name: string
  ) => {
    const confirmed = window.confirm(
      `${name} 인플루언서를 삭제하시겠습니까?`
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("influencers")
      .delete()
      .eq("id", id);

    setDeleting(false);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }

    setSelectedIds((prev) =>
      prev.filter((item) => item !== id)
    );

    router.refresh();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `${selectedIds.length}명의 인플루언서를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("influencers")
      .delete()
      .in("id", selectedIds);

    setDeleting(false);

    if (error) {
      alert(`일괄 삭제 실패: ${error.message}`);
      return;
    }

    setSelectedIds([]);
    router.refresh();
  };

  return (
    <div>
      {/* 통계 */}
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            전체 인플루언서
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {influencers.length.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            현재 검색 결과
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {filteredInfluencers.length.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            카테고리 수
          </p>

          <p className="mt-1 text-2xl font-bold text-slate-900">
            {categories.length}
          </p>
        </div>
      </div>

      {/* 필터 */}
      <section className="mb-6 rounded-2xl border border-slate-500 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            검색 및 필터
          </h2>

          <button
            type="button"
            onClick={resetFilters}
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            필터 초기화
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, Instagram ID, 이메일 검색"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 lg:col-span-2"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="all">
              전체 카테고리
            </option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={minFollowers}
            onChange={(e) => setMinFollowers(e.target.value)}
            placeholder="최소 팔로워"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
          />

          <input
            type="number"
            value={maxFollowers}
            onChange={(e) => setMaxFollowers(e.target.value)}
            placeholder="최대 팔로워"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <select
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as SortOption)
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="followers_desc">
              팔로워 많은 순
            </option>

            <option value="followers_asc">
              팔로워 적은 순
            </option>

            <option value="views_desc">
              평균 조회수 높은 순
            </option>

            <option value="rate_desc">
              협업 단가 높은 순
            </option>

            <option value="recent">
              최근 등록 순
            </option>
          </select>
        </div>
      </section>
      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-red-400 bg-red-50 px-5 py-4">
          <div>
            <p className="font-semibold text-red-700">
              {selectedIds.length}명 선택됨
            </p>

            <p className="mt-1 text-sm text-red-600">
              선택한 인플루언서를 한 번에 삭제할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              선택 해제
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting
                ? "삭제 중..."
                : "선택 삭제"}
            </button>
          </div>
        </div>
      )}
      {/* 목록 */}
      <section className="overflow-hidden rounded-2xl border border-slate-500 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="border-b border-slate-700 bg-slate-100 text-slate-600">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  이름
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  Instagram
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  카테고리
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  팔로워
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  평균 조회수
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  협업 단가
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  상세
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {filteredInfluencers.map((influencer) => (
                <tr
                  key={influencer.id}
                  onClick={() =>
                    router.push(`/influencers/${influencer.id}`
                    )
                  }
                  className="transition hover:bg-slate-100"
                >
                  <td className="w-12 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(
                        influencer.id
                      )}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() =>
                        toggleSelect(influencer.id)
                      }
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {influencer.name || "-"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {influencer.instagram_url ? (
                      <a
                        href={influencer.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:underline"
                      >
                        @{influencer.instagram_id}
                      </a>
                    ) : (
                      <>@{influencer.instagram_id}</>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {influencer.category ? (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {influencer.category}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-4 py-4 text-right text-slate-700">
                    {formatMan(influencer.followers)}
                  </td>

                  <td className="px-4 py-4 text-right text-slate-700">
                    {formatMan(influencer.avg_views)}
                  </td>

                  <td className="px-4 py-4 text-right text-slate-700">
                    {formatPriceMan(influencer.collaboration_rate)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-center gap-2">
                      

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();

                          handleDeleteOne(
                            influencer.id,
                            influencer.name ||
                              `@${influencer.instagram_id}`
                          );
                        }}
                        disabled={deleting}
                        className="rounded-lg border-2 border-red-400 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredInfluencers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-slate-400"
                  >
                    조건에 맞는 인플루언서가 없습니다.
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