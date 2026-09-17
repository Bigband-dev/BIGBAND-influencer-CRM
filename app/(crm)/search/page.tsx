"use client";

import { useState } from "react";

export default function SearchPage() {
  const [apifyToken, setApifyToken] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [product, setProduct] = useState("");

  const [seedAccounts, setSeedAccounts] = useState("");
  const [hashtags, setHashtags] = useState("");

  const [targetCount, setTargetCount] = useState("30");
  const [minFollowers, setMinFollowers] = useState("30000");
  const [maxFollowers, setMaxFollowers] = useState("300000");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [testProfile, setTestProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [relatedCandidates, setRelatedCandidates] =
    useState<any[]>([]);

  const [relatedLoading, setRelatedLoading] =
    useState(false);

  const [
    hashtagCandidates,
    setHashtagCandidates,
  ] = useState<any[]>([]);

  const [
    hashtagLoading,
    setHashtagLoading,
  ] = useState(false);

  function splitLines(value: string) {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function enrichCandidates(
    related: any[],
    hashtag: any[],
    seeds: string[]
  ) {
    const response = await fetch(
      "/api/apify/enrich",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apifyToken: apifyToken.trim(),

          relatedCandidates: related,
          hashtagCandidates: hashtag,

          seedAccounts: seeds,

          minFollowers: Number(minFollowers),
          maxFollowers: Number(maxFollowers),
        }),
      }
    );

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      console.error(
        "Enrich API non-json:",
        response.status,
        text
      );

      throw new Error(
        `Enrich API 오류 (${response.status})`
      );
    }

    if (!response.ok || !result.ok) {
      throw new Error(
        result.message ||
          "후보 Profile 조회에 실패했습니다."
      );
    }

    return result;
  }

  const [relatedResults, setRelatedResults] =
    useState<any[]>([]);

  const [hashtagResults, setHashtagResults] =
    useState<any[]>([]);

  const [mergedResults, setMergedResults] =
    useState<any[]>([]);

  const [relatedSearchLoading, setRelatedSearchLoading] =
    useState(false);

  const [hashtagSearchLoading, setHashtagSearchLoading] =
    useState(false);

  async function handleSearch() {
    setMessage("");

    if (!apifyToken.trim()) {
      setMessage("Apify API Key를 입력해주세요.");
      return;
    }

    const seeds = splitLines(seedAccounts).map((v) =>
      v.replace(/^@/, "")
    );

    const tags = splitLines(hashtags).map((v) =>
      v.replace(/^#/, "")
    );

    if (!seeds.length && !tags.length) {
      setMessage(
        "레퍼런스 계정 또는 검색 해시태그를 하나 이상 입력해주세요."
      );
      return;
    }

    const target = Number(targetCount);
    const min = Number(minFollowers);
    const max = Number(maxFollowers);

    if (!Number.isFinite(target) || target < 1) {
      setMessage("목표 후보 수를 확인해주세요.");
      return;
    }

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max < min
    ) {
      setMessage("팔로워 범위를 확인해주세요.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        apifyToken: apifyToken.trim(),
        campaignName: campaignName.trim(),
        product: product.trim(),
        seedAccounts: seeds,
        hashtags: tags,
        targetCount: target,
        minFollowers: min,
        maxFollowers: max,
      };

      const response = await fetch("/api/apify/verify", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            apifyToken: payload.apifyToken,
        }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
        setMessage(
            result.message || "Apify API Key 확인에 실패했습니다."
        );
        return;
        }

        setMessage(
        result.user?.username
            ? `Apify 연결 성공: ${result.user.username}`
            : "Apify 연결 성공"
        );
    } finally {
      setLoading(false);
    }
  }
  async function handleProfileTest() {
    setMessage("");
    setTestProfile(null);

    if (!apifyToken.trim()) {
        setMessage("Apify API Key를 입력해주세요.");
        return;
    }

    const seeds = splitLines(seedAccounts).map((v) =>
        v.replace(/^@/, "")
    );

    if (!seeds.length) {
        setMessage("테스트할 레퍼런스 계정을 하나 입력해주세요.");
        return;
    }

    setProfileLoading(true);

    try {
        const response = await fetch("/api/apify/profile", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            apifyToken: apifyToken.trim(),
            username: seeds[0],
        }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
        setMessage(
            result.message || "Profile 조회에 실패했습니다."
        );
        return;
        }

        setTestProfile(result.profile);

        setMessage(
        `@${result.profile.username} Profile 조회 성공`
        );
    } catch (error) {
        console.error(error);

        setMessage("Profile 조회 중 오류가 발생했습니다.");
    } finally {
        setProfileLoading(false);
    }
  }
  async function handleRelatedSearch() {
    setMessage("");
    setRelatedResults([]);
    setMergedResults([]);

    if (!apifyToken.trim()) {
      setMessage("Apify API Key를 입력해주세요.");
      return;
    }

    const seeds = splitLines(seedAccounts).map(
      (v) => v.replace(/^@/, "")
    );

    if (!seeds.length) {
      setMessage(
        "레퍼런스 계정을 하나 이상 입력해주세요."
      );
      return;
    }

    const target = Number(targetCount);

    if (!Number.isFinite(target) || target < 1) {
      setMessage("목표 후보 수를 확인해주세요.");
      return;
    }

    setRelatedSearchLoading(true);

    try {
      /*
        target=30이면 대략
        60 → 120 → 180 related 후보까지 확장

        follower filter에서 많이 빠지는 것을 고려하여
        목표 개수보다 넓게 수집한다.
      */
      const limits = Array.from(
        new Set([
          Math.max(20, target * 2),
          Math.max(40, target * 4),
          Math.max(80, target * 6),
        ])
      );

      let bestCandidates: any[] = [];
      let previousRawCount = -1;

      for (const limit of limits) {
        setMessage(
          `Related 후보 검색 중... 최대 ${limit}명 탐색`
        );

        const discoveryResponse = await fetch(
          "/api/apify/related",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apifyToken: apifyToken.trim(),
              seedAccounts: seeds,

              maxRelatedPerProfile: limit,
              maxCandidates: limit,
            }),
          }
        );

        const discovery =
          await discoveryResponse.json();

        if (
          !discoveryResponse.ok ||
          !discovery.ok
        ) {
          throw new Error(
            discovery.message ||
              "Related 검색에 실패했습니다."
          );
        }

        const rawCandidates =
          discovery.candidates || [];

        setRelatedCandidates(rawCandidates);

        if (!rawCandidates.length) {
          break;
        }

        const enriched = await enrichCandidates(
          rawCandidates,
          [],
          seeds
        );

        bestCandidates =
          enriched.candidates || [];

        setMessage(
          `Related ${rawCandidates.length}명 발견 → 팔로워 조건 ${bestCandidates.length}명 통과`
        );

        if (bestCandidates.length >= target) {
          break;
        }

        // 탐색 범위를 늘렸는데 후보 수가 전혀 늘지 않았다면
        // Actor가 더 이상 Related를 제공하지 않는 것으로 판단
        if (
          rawCandidates.length === previousRawCount
        ) {
          break;
        }

        previousRawCount =
          rawCandidates.length;
      }

      const finalResults =
        bestCandidates.slice(0, target);

      setRelatedResults(finalResults);

      if (finalResults.length >= target) {
        setMessage(
          `Related 검색 완료: 목표 ${target}명 확보`
        );
      } else {
        setMessage(
          `Related 검색 완료: 목표 ${target}명 중 ${finalResults.length}명 확보`
        );
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Related 검색 중 오류가 발생했습니다."
      );
    } finally {
      setRelatedSearchLoading(false);
    }
  }
  async function handleHashtagSearch() {
    setMessage("");
    setHashtagResults([]);
    setMergedResults([]);

    if (!apifyToken.trim()) {
      setMessage("Apify API Key를 입력해주세요.");
      return;
    }

    const tags = splitLines(hashtags).map(
      (value) => value.replace(/^#/, "")
    );

    if (!tags.length) {
      setMessage(
        "검색 해시태그를 하나 이상 입력해주세요."
      );
      return;
    }

    const target = Number(targetCount);

    if (!Number.isFinite(target) || target < 1) {
      setMessage("목표 후보 수를 확인해주세요.");
      return;
    }

    setHashtagSearchLoading(true);

    try {
      const limits = [
        50,
        100,
        200,
        400,
        500,
      ];

      let bestCandidates: any[] = [];

      for (const limit of limits) {
        setMessage(
          `Hashtag 검색 중... 게시물 최대 ${limit}개 탐색`
        );

        const discoveryResponse = await fetch(
          "/api/apify/hashtag",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              apifyToken:
                apifyToken.trim(),

              hashtags: tags,

              resultsLimit: limit,
            }),
          }
        );

        const discovery =
          await discoveryResponse.json();

        if (
          !discoveryResponse.ok ||
          !discovery.ok
        ) {
          throw new Error(
            discovery.message ||
              "Hashtag 검색에 실패했습니다."
          );
        }

        const rawCandidates =
          discovery.candidates || [];

        setHashtagCandidates(rawCandidates);

        if (!rawCandidates.length) {
          continue;
        }

        const enriched =
          await enrichCandidates(
            [],
            rawCandidates,
            []
          );

        bestCandidates =
          enriched.candidates || [];

        setMessage(
          `Hashtag limit ${limit}: ${rawCandidates.length}명 발견 → 팔로워 조건 ${bestCandidates.length}명 통과`
        );

        if (bestCandidates.length >= target) {
          break;
        }
      }

      const finalResults =
        bestCandidates.slice(0, target);

      setHashtagResults(finalResults);

      if (finalResults.length >= target) {
        setMessage(
          `Hashtag 검색 완료: 목표 ${target}명 확보`
        );
      } else {
        setMessage(
          `Hashtag 검색 완료: 목표 ${target}명 중 ${finalResults.length}명 확보`
        );
      }
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Hashtag 검색 중 오류가 발생했습니다."
      );
    } finally {
      setHashtagSearchLoading(false);
    }
  }
  function handleMergeResults() {
    setMessage("");

    if (
      relatedResults.length === 0 &&
      hashtagResults.length === 0
    ) {
      setMessage(
        "먼저 Related 또는 Hashtag 검색을 실행해주세요."
      );
      return;
    }

    const map = new Map<string, any>();

    for (const candidate of [
      ...relatedResults,
      ...hashtagResults,
    ]) {
      const key =
        String(candidate.username || "")
          .toLowerCase()
          .trim();

      if (!key) continue;

      const existing = map.get(key);

      if (!existing) {
        map.set(key, {
          ...candidate,

          discoverySources:
            candidate.discoverySources ||
            [candidate.source].filter(Boolean),
        });

        continue;
      }

      map.set(key, {
        ...existing,

        discoverySources: Array.from(
          new Set([
            ...(existing.discoverySources || []),
            ...(candidate.discoverySources || []),
            candidate.source,
          ].filter(Boolean))
        ),

        referenceHits: Array.from(
          new Set([
            ...(existing.referenceHits || []),
            ...(candidate.referenceHits || []),
          ])
        ),

        sourceHashtags: Array.from(
          new Set([
            ...(existing.sourceHashtags || []),
            ...(candidate.sourceHashtags || []),
          ])
        ),
      });
    }

    const merged =
      Array.from(map.values());

    setMergedResults(merged);

    setMessage(
      `결과 합치기 완료: Related ${relatedResults.length}명 + Hashtag ${hashtagResults.length}명 → 중복 제거 후 ${merged.length}명`
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          인플루언서 서칭
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          레퍼런스 계정과 해시태그를 기반으로 후보 인플루언서를
          탐색합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="grid gap-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Apify API Key
            </label>

            <input
              type="password"
              value={apifyToken}
              onChange={(e) => setApifyToken(e.target.value)}
              placeholder="apify_api_..."
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              API Key는 현재 검색 요청에만 사용하고 아직 DB에는
              저장하지 않습니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                캠페인 이름
              </label>

              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="예: 풀무원 Reset 48"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                제품 / 캠페인
              </label>

              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="예: 클렌즈 음료"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                레퍼런스 계정
              </label>

              <textarea
                value={seedAccounts}
                onChange={(e) => setSeedAccounts(e.target.value)}
                rows={8}
                placeholder={`gyujin...\nminyoung...\naccount3`}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                한 줄에 하나씩 입력하세요. @는 있어도 됩니다.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                검색 해시태그
              </label>

              <textarea
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                rows={8}
                placeholder={`자기관리\n운동\n클렌즈`}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />

              <p className="mt-2 text-xs text-slate-500">
                한 줄에 하나씩 입력하세요. #은 있어도 됩니다.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                목표 후보 수
              </label>

              <input
                type="number"
                min={1}
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                최소 팔로워
              </label>

              <input
                type="number"
                min={0}
                value={minFollowers}
                onChange={(e) => setMinFollowers(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                최대 팔로워
              </label>

              <input
                type="number"
                min={0}
                value={maxFollowers}
                onChange={(e) => setMaxFollowers(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}

          <div className="flex justify-end gap-3">
             <button
                type="button"
                disabled={relatedSearchLoading}
                onClick={handleRelatedSearch}
                className="rounded-lg bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {relatedSearchLoading
                  ? "Related 검색 중..."
                  : "Related 계정으로 찾기"}
              </button>

              <button
                type="button"
                disabled={hashtagSearchLoading}
                onClick={handleHashtagSearch}
                className="rounded-lg bg-blue-600 px-6 py-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {hashtagSearchLoading
                  ? "Hashtag 검색 중..."
                  : "해시태그로 찾기"}
              </button>

              <button
                type="button"
                onClick={handleMergeResults}
                disabled={
                  relatedResults.length === 0 &&
                  hashtagResults.length === 0
                }
                className="rounded-lg border border-slate-300 bg-white px-6 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                두 결과 합치기
              </button>
          </div>
        </div>
      </div>
      {testProfile && (
        <div className="mt-6 rounded-xl border border-slate-300 bg-white p-6">
            <div className="flex items-start gap-5">
            {testProfile.profilePicUrl && (
                <img
                src={testProfile.profilePicUrl}
                alt={testProfile.username}
                className="h-20 w-20 rounded-full object-cover"
                />
            )}

            <div>
                <div className="text-lg font-bold text-slate-900">
                {testProfile.fullName || testProfile.username}
                </div>

                <a
                href={testProfile.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
                >
                @{testProfile.username}
                </a>

                <div className="mt-3 text-sm text-slate-700">
                팔로워{" "}
                {testProfile.followers?.toLocaleString?.() ??
                    testProfile.followers ??
                    "-"}
                </div>

                <div className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-slate-600">
                {testProfile.biography}
                </div>
            </div>
            </div>
        </div>
        )}
        {relatedCandidates.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Related 후보
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {relatedCandidates.length}명
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-left">
                    <th className="px-4 py-3">
                      Instagram
                    </th>

                    <th className="px-4 py-3">
                      발견 기준
                    </th>

                    <th className="px-4 py-3">
                      Reference Hit
                    </th>

                    <th className="px-4 py-3">
                      Graph Score
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {relatedResults.length > 0 && (
                    <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
                      <div className="mb-4">
                        <h2 className="text-lg font-bold text-slate-900">
                          Related 검색 결과
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {relatedResults.length}명
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-300 bg-slate-50 text-left">
                              <th className="px-4 py-3">Instagram</th>
                              <th className="px-4 py-3">이름</th>
                              <th className="px-4 py-3">팔로워</th>
                              <th className="px-4 py-3">발견 경로</th>
                            </tr>
                          </thead>

                          <tbody>
                            {relatedResults.map((candidate) => (
                              <tr
                                key={candidate.username}
                                className="border-b border-slate-200"
                              >
                                <td className="px-4 py-3">
                                  <a
                                    href={candidate.instagramUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-blue-600 hover:underline"
                                  >
                                    @{candidate.username}
                                  </a>
                                </td>

                                <td className="px-4 py-3">
                                  {candidate.displayName || "-"}
                                </td>

                                <td className="px-4 py-3">
                                  {candidate.followers != null
                                    ? Number(candidate.followers).toLocaleString()
                                    : "-"}
                                </td>

                                <td className="px-4 py-3">
                                  Related
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {hashtagResults.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Hashtag 검색 결과
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {hashtagResults.length}명
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-left">
                    <th className="px-4 py-3">Instagram</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">팔로워</th>
                    <th className="px-4 py-3">발견 해시태그</th>
                  </tr>
                </thead>

                <tbody>
                  {hashtagResults.map((candidate) => (
                    <tr
                      key={candidate.username}
                      className="border-b border-slate-200"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={candidate.instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          @{candidate.username}
                        </a>
                      </td>

                      <td className="px-4 py-3">
                        {candidate.displayName || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {candidate.followers != null
                          ? Number(candidate.followers).toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        {candidate.sourceHashtags
                          ?.map((tag: string) => `#${tag}`)
                          .join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {mergedResults.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                통합 결과
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                중복 제거 후 {mergedResults.length}명
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-left">
                    <th className="px-4 py-3">Instagram</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">팔로워</th>
                    <th className="px-4 py-3">발견 경로</th>
                  </tr>
                </thead>

                <tbody>
                  {mergedResults.map((candidate) => (
                    <tr
                      key={candidate.username}
                      className="border-b border-slate-200"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={candidate.instagramUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          @{candidate.username}
                        </a>
                      </td>

                      <td className="px-4 py-3">
                        {candidate.displayName || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {candidate.followers != null
                          ? Number(candidate.followers).toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        {(candidate.discoverySources || [])
                          .map((source: string) =>
                            source === "seed_related"
                              ? "Related"
                              : source === "hashtag"
                              ? "Hashtag"
                              : source
                          )
                          .join(" + ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          검색 결과
        </h2>

        <div className="mt-6 rounded-lg border border-dashed border-slate-300 px-6 py-14 text-center text-sm text-slate-500">
          아직 검색 결과가 없습니다.
        </div>
      </div>
    </div>
  );
}