"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

import {
  formatMan,
  formatPriceMan,
} from "@/lib/format-number";

import PlatformBadge from "@/components/platform-badge";

import type {
  InfluencerChannel,
  InfluencerPlatform,
} from "@/types/influencer";

import { buildGmailComposeUrl } from "@/lib/gmail-compose";

type Influencer = {
  id: string;

  name: string | null;
  email: string | null;

  category: string | null;
  categories?: string[] | null;

  gender: string | null;
  age_group: string | null;

  collaboration_rate: number | null;

  memo: string | null;

  created_at: string | null;

  /*
   * 새 멀티채널 구조
   */
  channels?: InfluencerChannel[];

  /*
   * 기존 DB 호환용
   * 새 구조가 안정화될 때까지 유지
   */
  instagram_id?: string | null;
  instagram_url?: string | null;
  followers?: number | null;
  avg_views?: number | null;
};

type SortOption =
  | "followers_desc"
  | "followers_asc"
  | "views_desc"
  | "rate_desc"
  | "recent";

type PlatformFilter =
  | "all"
  | InfluencerPlatform;

/*
 * 대표 채널 찾기
 *
 * 1. is_primary=true 우선
 * 2. 없으면 첫 번째 채널
 */
function getPrimaryChannel(
  influencer: Influencer
): InfluencerChannel | null {
  if (
    influencer.channels &&
    influencer.channels.length > 0
  ) {
    return (
      influencer.channels.find(
        (channel) => channel.is_primary
      ) ??
      influencer.channels[0]
    );
  }

  /*
   * 기존 Instagram 데이터를 아직
   * influencer_channels로 옮기지 않은 경우 fallback
   */
  if (
    influencer.instagram_id ||
    influencer.instagram_url
  ) {
    return {
      platform: "instagram",
      channel_name: null,
      handle:
        influencer.instagram_id ?? null,
      url:
        influencer.instagram_url ?? null,
      followers:
        influencer.followers ?? null,
      avg_views:
        influencer.avg_views ?? null,
      is_primary: true,
      collaboration_rate:
        influencer.collaboration_rate ?? null,
      memo: null,
    };
  }

  return null;
}

/*
 * 필터/정렬에서 사용할 대표 팔로워
 */
function getFollowers(
  influencer: Influencer
) {
  const primary =
    getPrimaryChannel(influencer);

  return (
    primary?.followers ??
    influencer.followers ??
    0
  );
}

/*
 * 필터/정렬에서 사용할 대표 평균조회
 */
function getAvgViews(
  influencer: Influencer
) {
  const primary =
    getPrimaryChannel(influencer);

  return (
    primary?.avg_views ??
    influencer.avg_views ??
    0
  );
}

function getCollaborationRate(influencer: Influencer) {
  const primary = getPrimaryChannel(influencer);
  return primary?.collaboration_rate ?? influencer.collaboration_rate ?? 0;
}

export default function InfluencerTable({
  influencers,
  currentUserName,
  totalRegisteredInfluencers,
}: {
  influencers: Influencer[];
  currentUserName: string | null;
  totalRegisteredInfluencers: number;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("all");

  const [
    platformFilter,
    setPlatformFilter,
  ] =
    useState<PlatformFilter>("all");

  const [
    minFollowers,
    setMinFollowers,
  ] = useState("");

  const [
    maxFollowers,
    setMaxFollowers,
  ] = useState("");

  const [sort, setSort] =
    useState<SortOption>(
      "followers_desc"
    );

  const [
    selectedIds,
    setSelectedIds,
  ] =
    useState<string[]>([]);

  const [deleting, setDeleting] =
    useState(false);

  /*
   * 과거 Import에서 동일 채널이 서로 다른 influencers 행에 연결된 경우가 있어
   * 마케터 목록에서는 동일한 플랫폼 + 아이디를 한 번만 보여줍니다.
   *
   * 채널이 없는 legacy 행은 instagram_id를 기준으로 묶고,
   * 식별 가능한 채널 정보가 전혀 없는 행만 개별 ID를 유지합니다.
   */
  const uniqueInfluencers = useMemo(() => {
    const seen = new Set<string>();
    const result: Influencer[] = [];

    for (const influencer of influencers) {
      const primary = getPrimaryChannel(influencer);

      const platform =
        primary?.platform ??
        (influencer.instagram_id ? "instagram" : null);

      const handle =
        primary?.handle ??
        influencer.instagram_id ??
        null;

      const key =
        platform && handle
          ? `${platform}::${handle.trim().toLowerCase()}`
          : `influencer::${influencer.id}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(influencer);
    }

    return result;
  }, [influencers]);

  /*
   * 카테고리 목록
   */
  const categories = useMemo(() => {
    const values = uniqueInfluencers.flatMap(
      (item) =>
        item.categories?.length
          ? item.categories
          : item.category
            ? [item.category]
            : []
    );

    return [
      ...new Set(values),
    ].sort();
  }, [uniqueInfluencers]);

  /*
   * 검색 + 필터 + 정렬
   */
  const filteredInfluencers =
    useMemo(() => {
      const keyword =
        search
          .toLowerCase()
          .trim();

      const min =
        minFollowers
          ? Number(
              minFollowers
            )
          : null;

      const max =
        maxFollowers
          ? Number(
              maxFollowers
            )
          : null;

      const result =
        uniqueInfluencers.filter(
          (influencer) => {
            /*
             * 채널 정보 검색
             */
            const channelSearchMatch =
              influencer.channels?.some(
                (channel) =>
                  channel.handle
                    ?.toLowerCase()
                    .includes(
                      keyword
                    ) ||
                  channel.channel_name
                    ?.toLowerCase()
                    .includes(
                      keyword
                    ) ||
                  channel.platform
                    .toLowerCase()
                    .includes(
                      keyword
                    )
              ) ?? false;

            const influencerCategories =
              influencer.categories?.length
                ? influencer.categories
                : influencer.category
                  ? [influencer.category]
                  : [];

            const categorySearchMatch =
              influencerCategories.some(
                (item) =>
                  item
                    .toLowerCase()
                    .includes(keyword)
              );

            const searchMatch =
              !keyword ||
              influencer.name
                ?.toLowerCase()
                .includes(
                  keyword
                ) ||
              influencer.email
                ?.toLowerCase()
                .includes(
                  keyword
                ) ||
              categorySearchMatch ||
              influencer.instagram_id
                ?.toLowerCase()
                .includes(
                  keyword
                ) ||
              channelSearchMatch;

            const categoryMatch =
              category === "all" ||
              influencerCategories.includes(
                category
              );

            /*
             * 플랫폼 필터
             */
            const platformMatch =
              platformFilter ===
                "all" ||
              influencer.channels?.some(
                (channel) =>
                  channel.platform ===
                  platformFilter
              ) ||
              (
                platformFilter ===
                  "instagram" &&
                !influencer
                  .channels
                  ?.length &&
                Boolean(
                  influencer.instagram_id ||
                    influencer.instagram_url
                )
              );

            const followers =
              getFollowers(
                influencer
              );

            const minMatch =
              min === null ||
              followers >= min;

            const maxMatch =
              max === null ||
              followers <= max;

            return (
              searchMatch &&
              categoryMatch &&
              platformMatch &&
              minMatch &&
              maxMatch
            );
          }
        );

      /*
       * 정렬
       */
      result.sort(
        (a, b) => {
          switch (sort) {
            case "followers_desc":
              return (
                getFollowers(
                  b
                ) -
                getFollowers(
                  a
                )
              );

            case "followers_asc":
              return (
                getFollowers(
                  a
                ) -
                getFollowers(
                  b
                )
              );

            case "views_desc":
              return (
                getAvgViews(
                  b
                ) -
                getAvgViews(
                  a
                )
              );

            case "rate_desc":
              return getCollaborationRate(b) - getCollaborationRate(a);

            case "recent":
              return (
                new Date(
                  b.created_at ??
                    0
                ).getTime() -
                new Date(
                  a.created_at ??
                    0
                ).getTime()
              );

            default:
              return 0;
          }
        }
      );

      return result;
    }, [
      uniqueInfluencers,
      search,
      category,
      platformFilter,
      minFollowers,
      maxFollowers,
      sort,
    ]);

  /*
   * 필터 초기화
   */
  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setPlatformFilter(
      "all"
    );
    setMinFollowers("");
    setMaxFollowers("");
    setSort(
      "followers_desc"
    );
  };

  /*
   * 체크박스
   */
  const allVisibleSelected =
    filteredInfluencers.length >
      0 &&
    filteredInfluencers.every(
      (item) =>
        selectedIds.includes(
          item.id
        )
    );

  const toggleSelect = (
    id: string
  ) => {
    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (item) =>
                item !== id
            )
          : [
              ...prev,
              id,
            ]
    );
  };

  const toggleSelectAll =
    () => {
      const visibleIds =
        filteredInfluencers.map(
          (item) =>
            item.id
        );

      if (
        allVisibleSelected
      ) {
        setSelectedIds(
          (prev) =>
            prev.filter(
              (id) =>
                !visibleIds.includes(
                  id
                )
            )
        );
      } else {
        setSelectedIds(
          (prev) => [
            ...new Set([
              ...prev,
              ...visibleIds,
            ]),
          ]
        );
      }
    };

  /*
   * 단일 삭제
   */
  const handleDeleteOne =
    async (
      id: string,
      name: string
    ) => {
      const confirmed =
        window.confirm(
          `${name} 인플루언서를 삭제하시겠습니까?`
        );

      if (!confirmed) {
        return;
      }

      setDeleting(true);

      const { error } =
        await supabase
          .from(
            "influencers"
          )
          .delete()
          .eq("id", id);

      setDeleting(false);

      if (error) {
        alert(
          `삭제 실패: ${error.message}`
        );

        return;
      }

      setSelectedIds(
        (prev) =>
          prev.filter(
            (item) =>
              item !== id
          )
      );

      router.refresh();
    };

  /*
   * 일괄 삭제
   */
  const handleBulkDelete =
    async () => {
      if (
        selectedIds.length ===
        0
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `${selectedIds.length}명의 인플루언서를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
        );

      if (!confirmed) {
        return;
      }

      setDeleting(true);

      const { error } =
        await supabase
          .from(
            "influencers"
          )
          .delete()
          .in(
            "id",
            selectedIds
          );

      setDeleting(false);

      if (error) {
        alert(
          `일괄 삭제 실패: ${error.message}`
        );

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
            {totalRegisteredInfluencers.toLocaleString()}
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

      {/* 검색 / 필터 */}
      <section className="mb-6 rounded-2xl border border-slate-500 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            검색 및 필터
          </h2>

          <button
            type="button"
            onClick={
              resetFilters
            }
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            필터 초기화
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-6">
          {/* 검색 */}
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target
                  .value
              )
            }
            placeholder="이름, 채널 ID, 이메일 검색"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 lg:col-span-2"
          />

          {/* 카테고리 */}
          <select
            value={
              category
            }
            onChange={(e) =>
              setCategory(
                e.target
                  .value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="all">
              전체 카테고리
            </option>

            {categories.map(
              (item) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {
                    item
                  }
                </option>
              )
            )}
          </select>

          {/* 플랫폼 */}
          <select
            value={
              platformFilter
            }
            onChange={(e) =>
              setPlatformFilter(
                e.target
                  .value as PlatformFilter
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          >
            <option value="all">
              전체 채널
            </option>

            <option value="instagram">
              Instagram
            </option>

            <option value="youtube">
              YouTube
            </option>

            <option value="tiktok">
              TikTok
            </option>

            <option value="naver_blog">
              Naver Blog
            </option>

            <option value="xiaohongshu">
              Xiaohongshu
            </option>
          </select>

          {/* 최소 팔로워 */}
          <input
            type="number"
            value={
              minFollowers
            }
            onChange={(e) =>
              setMinFollowers(
                e.target
                  .value
              )
            }
            placeholder="최소 팔로워"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
          />

          {/* 최대 팔로워 */}
          <input
            type="number"
            value={
              maxFollowers
            }
            onChange={(e) =>
              setMaxFollowers(
                e.target
                  .value
              )
            }
            placeholder="최대 팔로워"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <select
            value={sort}
            onChange={(e) =>
              setSort(
                e.target
                  .value as SortOption
              )
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

      {/* 선택 삭제 */}
      {selectedIds.length >
        0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border-2 border-red-400 bg-red-50 px-5 py-4">
          <div>
            <p className="font-semibold text-red-700">
              {
                selectedIds.length
              }
              명 선택됨
            </p>

            <p className="mt-1 text-sm text-red-600">
              선택한 인플루언서를
              한 번에 삭제할
              수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  []
                )
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              선택 해제
            </button>

            <button
              type="button"
              onClick={
                handleBulkDelete
              }
              disabled={
                deleting
              }
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
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-slate-700 bg-slate-100 text-slate-600">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={
                      allVisibleSelected
                    }
                    onChange={
                      toggleSelectAll
                    }
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  이름
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  카테고리
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  대표 채널
                </th>

                <th className="px-4 py-3 text-left font-medium">
                  보유 채널
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  대표 팔로워
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  평균 조회수
                </th>

                <th className="px-4 py-3 text-right font-medium">
                  대표 채널 단가
                </th>

                <th className="px-4 py-3 text-center font-medium">
                  관리
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {filteredInfluencers.map(
                (
                  influencer
                ) => {
                  const primaryChannel =
                    getPrimaryChannel(
                      influencer
                    );

                  /*
                   * 실제 등록된 channels 우선
                   */
                  const channels =
                    influencer.channels &&
                    influencer
                      .channels
                      .length >
                      0
                      ? influencer.channels
                      : primaryChannel
                      ? [
                          primaryChannel,
                        ]
                      : [];

                  return (
                    <tr
                      key={
                        influencer.id
                      }
                      onClick={() =>
                        router.push(
                          `/influencers/${influencer.id}`
                        )
                      }
                      className="cursor-pointer transition hover:bg-slate-100"
                    >
                      {/* 체크 */}
                      <td className="w-12 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(
                            influencer.id
                          )}
                          onClick={(
                            e
                          ) =>
                            e.stopPropagation()
                          }
                          onChange={() =>
                            toggleSelect(
                              influencer.id
                            )
                          }
                          className="h-4 w-4 cursor-pointer"
                        />
                      </td>

                      {/* 이름 */}
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {influencer.name ||
                              "-"}
                          </p>

                          {influencer.email ? (
                            <a
                              href={buildGmailComposeUrl({
                                email: influencer.email,
                                influencerName: influencer.name,
                                userName: currentUserName,
                              })}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              {influencer.email}
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* 카테고리 */}
                      <td className="px-4 py-4">
                        {(
                          influencer.categories?.length
                            ? influencer.categories
                            : influencer.category
                              ? [influencer.category]
                              : []
                        ).length > 0 ? (
                          <div className="flex max-w-[280px] flex-wrap gap-1.5">
                            {(
                              influencer.categories?.length
                                ? influencer.categories
                                : influencer.category
                                  ? [influencer.category]
                                  : []
                            ).map((category) => (
                              <span
                                key={category}
                                className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 대표 채널 */}
                      <td className="px-4 py-4">
                        {primaryChannel ? (
                          <div className="space-y-1.5">
                            <PlatformBadge
                              platform={
                                primaryChannel.platform
                              }
                            />

                            {primaryChannel.url ? (
                              <div>
                                <a
                                  href={
                                    primaryChannel.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(
                                    e
                                  ) =>
                                    e.stopPropagation()
                                  }
                                  className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                                >
                                  {primaryChannel.handle
                                    ? `@${primaryChannel.handle}`
                                    : primaryChannel.channel_name ||
                                      "채널 열기"}
                                </a>
                              </div>
                            ) : primaryChannel.handle ? (
                              <p className="text-xs text-slate-500">
                                @
                                {
                                  primaryChannel.handle
                                }
                              </p>
                            ) : primaryChannel.channel_name ? (
                              <p className="text-xs text-slate-500">
                                {
                                  primaryChannel.channel_name
                                }
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* 보유 채널 */}
                      <td className="px-4 py-4">
                        {channels.length >
                        0 ? (
                          <div className="flex max-w-[240px] flex-wrap gap-1.5">
                            {channels.map(
                              (
                                channel,
                                index
                              ) => (
                                <PlatformBadge
                                  key={
                                    channel.id ??
                                    `${influencer.id}-${channel.platform}-${channel.handle ?? index}`
                                  }
                                  platform={
                                    channel.platform
                                  }
                                  compact
                                />
                              )
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* 팔로워 */}
                      <td className="px-4 py-4 text-right font-medium text-slate-700">
                        {formatMan(
                          primaryChannel?.followers ??
                            influencer.followers ??
                            null
                        )}
                      </td>

                      {/* 평균 조회 */}
                      <td className="px-4 py-4 text-right text-slate-700">
                        {formatMan(
                          primaryChannel?.avg_views ??
                            influencer.avg_views ??
                            null
                        )}
                      </td>

                      {/* 협업 단가 */}
                      <td className="px-4 py-4 text-right text-slate-700">
                        {formatPriceMan(primaryChannel?.collaboration_rate ?? influencer.collaboration_rate)}
                      </td>

                      {/* 관리 */}
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={(
                              e
                            ) => {
                              e.stopPropagation();

                              handleDeleteOne(
                                influencer.id,
                                influencer.name ||
                                  primaryChannel?.handle ||
                                  "인플루언서"
                              );
                            }}
                            disabled={
                              deleting
                            }
                            className="rounded-lg border-2 border-red-400 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
              )}

              {filteredInfluencers.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      9
                    }
                    className="px-4 py-16 text-center text-slate-400"
                  >
                    조건에 맞는
                    인플루언서가
                    없습니다.
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
