"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");

  const [sort, setSort] = useState<SortOption>("followers_desc");

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

      {/* 목록 */}
      <section className="overflow-hidden rounded-2xl border border-slate-500 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="border-b border-slate-700 bg-slate-100 text-slate-600">
              <tr>
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
                  className="transition hover:bg-slate-100"
                >
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {influencer.name || "-"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        @{influencer.instagram_id}
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

                  <td className="px-4 py-4 text-center">
                    <Link
                      href={`/influencers/${influencer.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      보기
                    </Link>
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