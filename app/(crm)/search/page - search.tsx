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

  const [
    enrichedCandidates,
    setEnrichedCandidates,
  ] = useState<any[]>([]);

  const [
    enrichLoading,
    setEnrichLoading,
  ] = useState(false);

  function splitLines(value: string) {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

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
  async function handleRelatedTest() {
    setMessage("");
    setRelatedCandidates([]);

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

    setRelatedLoading(true);

    try {
      const response = await fetch(
        "/api/apify/related",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            apifyToken: apifyToken.trim(),
            seedAccounts: seeds,

            // 기존 MVP 기본값과 동일
            maxRelatedPerProfile: 20,
            maxCandidates: 30,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(
          result.message ||
            "Related 검색에 실패했습니다."
        );
        return;
      }

      setRelatedCandidates(
        result.candidates || []
      );

      setMessage(
        `Related 후보 ${result.count}명 검색 완료`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Related 검색 중 오류가 발생했습니다."
      );
    } finally {
      setRelatedLoading(false);
    }
  }
  async function handleHashtagTest() {
    setMessage("");
    setHashtagCandidates([]);

    if (!apifyToken.trim()) {
      setMessage(
        "Apify API Key를 입력해주세요."
      );
      return;
    }

    const tags = splitLines(
      hashtags
    ).map((value) =>
      value.replace(/^#/, "")
    );

    if (!tags.length) {
      setMessage(
        "검색 해시태그를 하나 이상 입력해주세요."
      );
      return;
    }

    setHashtagLoading(true);

    try {
      const response = await fetch(
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

            // 일단 1차 테스트
            resultsLimit: 50,
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        setMessage(
          result.message ||
            "Hashtag 검색에 실패했습니다."
        );
        return;
      }

      setHashtagCandidates(
        result.candidates || []
      );

      setMessage(
        `Hashtag 검색 완료: 게시물 ${result.stats?.usableMediaRows ?? 0}개 / 후보 ${result.stats?.uniqueCreators ?? 0}명`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Hashtag 검색 중 오류가 발생했습니다."
      );
    } finally {
      setHashtagLoading(false);
    }
  }
  async function handleEnrichCandidates() {
    setMessage("");
    setEnrichedCandidates([]);

    if (!apifyToken.trim()) {
      setMessage(
        "Apify API Key를 입력해주세요."
      );
      return;
    }

    if (
      relatedCandidates.length === 0 &&
      hashtagCandidates.length === 0
    ) {
      setMessage(
        "먼저 Related 또는 Hashtag 검색을 실행해주세요."
      );
      return;
    }

    const seeds = splitLines(
      seedAccounts
    ).map((v) =>
      v.replace(/^@/, "")
    );

    setEnrichLoading(true);

    try {
      console.log("MERGE INPUT", {
        relatedCount: relatedCandidates.length,
        hashtagCount: hashtagCandidates.length,
        related: relatedCandidates,
        hashtag: hashtagCandidates,
      });

      const response = await fetch(
        "/api/apify/enrich",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            apifyToken:
              apifyToken.trim(),

            relatedCandidates,

            hashtagCandidates,

            seedAccounts: seeds,

            minFollowers:
              Number(minFollowers),

            maxFollowers:
              Number(maxFollowers),
          }),
        }
      );

      const text =
        await response.text();

      let result;

      try {
        result =
          JSON.parse(text);
      } catch {
        console.error(
          "Enrich non-json:",
          response.status,
          text
        );

        setMessage(
          `후보 필터 API 오류 (${response.status})`
        );

        return;
      }

      if (
        !response.ok ||
        !result.ok
      ) {
        setMessage(
          result.message ||
            "후보 필터링에 실패했습니다."
        );

        return;
      }

      setEnrichedCandidates(
        result.candidates || []
      );

      setMessage(
        `후보 통합 완료: ${result.stats.merged}명 → 팔로워 조건 충족 ${result.stats.followerFit}명`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "후보 통합 중 오류가 발생했습니다."
      );
    } finally {
      setEnrichLoading(false);
    }
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
              disabled={enrichLoading}
              onClick={handleEnrichCandidates}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {enrichLoading
                ? "후보 필터링 중..."
                : "후보 통합 + 팔로워 필터"}
            </button>
            <button
              type="button"
              disabled={hashtagLoading}
              onClick={handleHashtagTest}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {hashtagLoading
                ? "Hashtag 검색 중..."
                : "Hashtag 테스트"}
            </button>
            <button
              type="button"
              disabled={relatedLoading}
              onClick={handleRelatedTest}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {relatedLoading
                ? "Related 검색 중..."
                : "Related 테스트"}
            </button>
            <button
                type="button"
                disabled={profileLoading}
                onClick={handleProfileTest}
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                {profileLoading
                    ? "Profile 조회 중..."
                    : "Profile 테스트"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSearch}
              className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "확인 중..." : "인플루언서 찾기"}
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
                  {relatedCandidates.map(
                    (candidate) => (
                      <tr
                        key={candidate.username}
                        className="border-b border-slate-200"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={
                              candidate.profileUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            @{candidate.username}
                          </a>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          @{candidate.sourceSeed}
                        </td>

                        <td className="px-4 py-3">
                          {candidate.referenceHits?.join(
                            ", "
                          ) || "-"}
                        </td>

                        <td className="px-4 py-3">
                          {typeof candidate.graphSimilarity ===
                          "number"
                            ? candidate.graphSimilarity.toFixed(
                                3
                              )
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {hashtagCandidates.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Hashtag 후보
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {hashtagCandidates.length}명
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
                      발견 해시태그
                    </th>

                    <th className="px-4 py-3">
                      발견 게시물
                    </th>

                    <th className="px-4 py-3">
                      광고성
                    </th>

                    <th className="px-4 py-3">
                      광고 비율
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {hashtagCandidates.map(
                    (candidate) => (
                      <tr
                        key={
                          candidate.username
                        }
                        className="border-b border-slate-200"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={
                              candidate.profileUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            @{candidate.username}
                          </a>
                        </td>

                        <td className="px-4 py-3">
                          {candidate.sourceHashtags
                            ?.map(
                              (tag: string) =>
                                `#${tag}`
                            )
                            .join(", ") ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {
                            candidate.hashtagDiscoveryPosts
                          }
                        </td>

                        <td className="px-4 py-3">
                          {
                            candidate.hashtagAdPosts
                          }
                        </td>

                        <td className="px-4 py-3">
                          {typeof candidate.hashtagAdRatio ===
                          "number"
                            ? `${(
                                candidate.hashtagAdRatio *
                                100
                              ).toFixed(1)}%`
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {enrichedCandidates.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-300 bg-white p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                1차 후보 리스트
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                팔로워 조건을 통과한 후보{" "}
                {enrichedCandidates.length}명
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
                      이름
                    </th>

                    <th className="px-4 py-3">
                      팔로워
                    </th>

                    <th className="px-4 py-3">
                      발견 경로
                    </th>

                    <th className="px-4 py-3">
                      Reference
                    </th>

                    <th className="px-4 py-3">
                      Graph
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {enrichedCandidates.map(
                    (candidate) => (
                      <tr
                        key={
                          candidate.username
                        }
                        className="border-b border-slate-200"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={
                              candidate.instagramUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-600 hover:underline"
                          >
                            @{candidate.username}
                          </a>
                        </td>

                        <td className="px-4 py-3">
                          {candidate.displayName ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 font-medium">
                          {candidate.followers !=
                          null
                            ? Number(
                                candidate.followers
                              ).toLocaleString()
                            : "-"}
                        </td>

                        <td className="px-4 py-3">
                          {(candidate.discoverySources ||
                            [])
                            .map(
                              (source: string) =>
                                source ===
                                "seed_related"
                                  ? "Related"
                                  : source ===
                                    "hashtag"
                                  ? "Hashtag"
                                  : source
                            )
                            .join(" + ")}
                        </td>

                        <td className="px-4 py-3">
                          {candidate.referenceHits
                            ?.map(
                              (x: string) =>
                                `@${x}`
                            )
                            .join(", ") ||
                            "-"}
                        </td>

                        <td className="px-4 py-3">
                          {typeof candidate.graphSimilarity ===
                          "number"
                            ? candidate.graphSimilarity.toFixed(
                                3
                              )
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
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