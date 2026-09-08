"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPriceMan } from "@/lib/format-number";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "name"
  | "instagram_id"
  | "instagram_url"
  | "email"
  | "followers"
  | "avg_views"
  | "category"
  | "collaboration_rate";

type Mapping = Record<FieldKey, string>;

type NumberUnit =
  | "auto"
  | "one"
  | "thousand"
  | "ten_thousand";

type ImportRow = {
  name: string | null;
  instagram_id: string;
  instagram_url: string | null;
  email: string | null;
  followers: number | null;
  avg_views: number | null;
  category: string | null;
  collaboration_rate: number | null;
};

const EMPTY_MAPPING: Mapping = {
  name: "",
  instagram_id: "",
  instagram_url: "",
  email: "",
  followers: "",
  avg_views: "",
  category: "",
  collaboration_rate: "",
};

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "이름",
  instagram_id: "Instagram ID",
  instagram_url: "Instagram URL",
  email: "이메일",
  followers: "팔로워",
  avg_views: "평균 조회수",
  category: "카테고리",
  collaboration_rate: "협업 단가",
};

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  name: [
    "name",
    "이름",
    "인플루언서",
    "인플루언서명",
    "채널명",
    "크리에이터",
  ],

  instagram_id: [
    "instagram_id",
    "instagram id",
    "instagram",
    "ig",
    "ig id",
    "인스타",
    "인스타그램",
    "인스타그램 id",
    "인스타 id",
    "인스타계정",
    "인스타 계정",
    "인스타그램 계정",
    "계정",
    "아이디",
  ],

  instagram_url: [
    "instagram_url",
    "instagram url",
    "인스타그램 url",
    "인스타 url",
    "인스타 링크",
    "인스타그램 링크",
    "sns url",
    "링크",
  ],

  email: [
    "email",
    "e-mail",
    "메일",
    "이메일",
    "이메일 주소",
  ],

  followers: [
    "followers",
    "follower",
    "팔로워",
    "팔로워수",
    "팔로워 수",
  ],

  avg_views: [
    "avg_views",
    "average views",
    "조회수",
    "평균조회수",
    "평균 조회수",
    "평균 릴스 조회수",
    "릴스 평균 조회수",
  ],

  category: [
    "category",
    "카테고리",
    "분류",
    "유형",
  ],

  collaboration_rate: [
    "collaboration_rate",
    "rate",
    "단가",
    "협업단가",
    "협업 단가",
    "광고비",
    "광고 단가",
    "광고단가",
  ],
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "")
    .trim();
}

function guessMapping(headers: string[]) {
  const next: Mapping = { ...EMPTY_MAPPING };

  for (const field of Object.keys(FIELD_ALIASES) as FieldKey[]) {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);

    const exact = headers.find((header) =>
      aliases.includes(normalizeHeader(header))
    );

    if (exact) {
      next[field] = exact;
      continue;
    }

    const partial = headers.find((header) => {
      const normalizedHeader = normalizeHeader(header);

      return aliases.some(
        (alias) =>
          normalizedHeader.includes(alias) ||
          alias.includes(normalizedHeader)
      );
    });

    if (partial) {
      next[field] = partial;
    }
  }

  return next;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeNumber(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/원/g, "")
    .replace(/\s/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function normalizeMetricNumber(
  value: unknown,
  unit: NumberUnit = "auto"
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  let text = String(value)
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/명/g, "")
    .replace(/회/g, "");

  if (!text) return null;

  // 단위가 값 자체에 포함된 경우
  if (text.includes("만")) {
    const number = Number(
      text.replace(/만/g, "")
    );

    return Number.isFinite(number)
      ? Math.round(number * 10000)
      : null;
  }

  if (
    text.includes("천") ||
    text.includes("k")
  ) {
    const number = Number(
      text
        .replace(/천/g, "")
        .replace(/k/g, "")
    );

    return Number.isFinite(number)
      ? Math.round(number * 1000)
      : null;
  }

  if (text.includes("m")) {
    const number = Number(
      text.replace(/m/g, "")
    );

    return Number.isFinite(number)
      ? Math.round(number * 1000000)
      : null;
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return null;
  }

  switch (unit) {
    case "ten_thousand":
      return Math.round(number * 10000);

    case "thousand":
      return Math.round(number * 1000);

    case "one":
    case "auto":
    default:
      return Math.round(number);
  }
}

function extractInstagramId(value: unknown) {
  let text = normalizeText(value);

  if (!text) return "";

  text = text
    .replace(/^@/, "")
    .replace(
      /^https?:\/\/(www\.)?instagram\.com\//i,
      ""
    )
    .replace(/^www\.instagram\.com\//i, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "")
    .split("/")[0]
    .trim();

  return text;
}

export default function ExcelImport() {
  const supabase = createClient();
  const router = useRouter();

  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] =
    useState<Mapping>(EMPTY_MAPPING);

  const [followersUnit, setFollowersUnit] =
    useState<NumberUnit>("auto");

  const [viewsUnit, setViewsUnit] =
    useState<NumberUnit>("auto");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");
    setFileName(file.name);
    setRawRows([]);
    setHeaders([]);
    setMapping(EMPTY_MAPPING);

    try {
      const data = await file.arrayBuffer();

      const workbook = XLSX.read(data, {
        type: "array",
      });

      const firstSheetName = workbook.SheetNames[0];
      const firstSheet =
        workbook.Sheets[firstSheetName];

      const parsedRows =
        XLSX.utils.sheet_to_json<RawRow>(
          firstSheet,
          {
            defval: "",
          }
        );

      if (parsedRows.length === 0) {
        setMessage(
          "Excel 파일에서 데이터를 찾지 못했습니다."
        );
        return;
      }

      const detectedHeaders = Object.keys(
        parsedRows[0]
      );

      const autoMapping =
        guessMapping(detectedHeaders);

      setRawRows(parsedRows);
      setHeaders(detectedHeaders);
      setMapping(autoMapping);

      setMessage(
        `${parsedRows.length.toLocaleString()}개 행을 읽었습니다. 컬럼 매핑을 확인해주세요.`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Excel 파일을 읽는 중 오류가 발생했습니다."
      );
    }
  };

  const mappedRows = useMemo(() => {
    if (!rawRows.length) return [];

    return rawRows
      .map((row): ImportRow => {
        const instagramIdSource =
          mapping.instagram_id
            ? row[mapping.instagram_id]
            : null;

        const instagramUrlSource =
          mapping.instagram_url
            ? row[mapping.instagram_url]
            : null;

        let instagramId =
          extractInstagramId(instagramIdSource);

        if (!instagramId && instagramUrlSource) {
          instagramId =
            extractInstagramId(
              instagramUrlSource
            );
        }

        let instagramUrl = mapping.instagram_url
          ? normalizeText(
              row[mapping.instagram_url]
            )
          : "";

        if (!instagramUrl && instagramId) {
          instagramUrl =
            `https://www.instagram.com/${instagramId}/`;
        }

        return {
          name: mapping.name
            ? normalizeText(
                row[mapping.name]
              ) || null
            : null,

          instagram_id: instagramId,

          instagram_url:
            instagramUrl || null,

          email: mapping.email
            ? normalizeText(
                row[mapping.email]
              ) || null
            : null,

          followers: mapping.followers
            ? normalizeMetricNumber(
                row[mapping.followers],
                followersUnit
              )
            : null,

          avg_views: mapping.avg_views
            ? normalizeMetricNumber(
                row[mapping.avg_views],
                viewsUnit
              )
            : null,

          category: mapping.category
            ? normalizeText(
                row[mapping.category]
              ) || null
            : null,

          collaboration_rate:
            mapping.collaboration_rate
              ? normalizeNumber(
                  row[
                    mapping.collaboration_rate
                  ]
                )
              : null,
        };
      })
      .filter((row) => row.instagram_id);
  }, [
    rawRows,
    mapping,
    followersUnit,
    viewsUnit,
  ]);

  const invalidCount =
    rawRows.length - mappedRows.length;

  const updateMapping = (
    field: FieldKey,
    value: string
  ) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImport = async () => {
    if (!mapping.instagram_id) {
      setMessage(
        "Instagram ID 컬럼을 먼저 지정해주세요."
      );
      return;
    }

    if (mappedRows.length === 0) {
      setMessage(
        "업로드 가능한 인플루언서 데이터가 없습니다."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("influencers")
      .upsert(mappedRows, {
        onConflict: "instagram_id",
      });

    setLoading(false);

    if (error) {
      setMessage(
        `DB 반영 실패: ${error.message}`
      );
      return;
    }

    setMessage(
      `${mappedRows.length.toLocaleString()}명의 인플루언서를 DB에 반영했습니다.`
    );

    router.refresh();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          Excel 파일 선택
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          첫 번째 시트를 읽고 컬럼을 자동으로 인식합니다.
        </p>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="mt-5 block w-full text-sm"
        />

        {fileName && (
          <p className="mt-3 text-sm text-slate-600">
            선택된 파일: {fileName}
          </p>
        )}
      </section>

      {rawRows.length > 0 && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                컬럼 매핑
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                자동으로 선택된 컬럼이 맞는지 확인하고 필요한 경우 직접 수정해주세요.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(
                Object.keys(
                  FIELD_LABELS
                ) as FieldKey[]
              ).map((field) => (
                <div
                  key={field}
                  className="grid grid-cols-[150px_1fr] items-center gap-3"
                >
                  <label className="text-sm font-medium text-slate-700">
                    {FIELD_LABELS[field]}
                    {field ===
                      "instagram_id" && (
                      <span className="ml-1 text-red-500">
                        *
                      </span>
                    )}
                  </label>

                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      updateMapping(
                        field,
                        e.target.value
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">
                      매핑 안 함
                    </option>

                    {headers.map((header) => (
                      <option
                        key={header}
                        value={header}
                      >
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                팔로워 / 조회수 단위
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Excel에서 숫자 19가 19만을 의미한다면
                '만 단위'를 선택해주세요.
                '19만', '3.2천'처럼 단위가 포함된 값은 자동으로 처리됩니다.
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    팔로워 원본 단위
                  </label>

                  <select
                    value={followersUnit}
                    onChange={(e) =>
                      setFollowersUnit(
                        e.target.value as NumberUnit
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="auto">
                      자동
                    </option>

                    <option value="one">
                      명 단위
                    </option>

                    <option value="thousand">
                      천 단위
                    </option>

                    <option value="ten_thousand">
                      만 단위
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    조회수 원본 단위
                  </label>

                  <select
                    value={viewsUnit}
                    onChange={(e) =>
                      setViewsUnit(
                        e.target.value as NumberUnit
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="auto">
                      자동
                    </option>

                    <option value="one">
                      회 단위
                    </option>

                    <option value="thousand">
                      천 단위
                    </option>

                    <option value="ten_thousand">
                      만 단위
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="font-semibold">
                  업로드 미리보기
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  전체{" "}
                  {rawRows.length.toLocaleString()}
                  개 중{" "}
                  {mappedRows.length.toLocaleString()}
                  개 업로드 가능
                </p>
              </div>

              {invalidCount > 0 && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  Instagram ID 없음{" "}
                  {invalidCount.toLocaleString()}개
                </span>
              )}
            </div>

            <div className="max-h-[500px] overflow-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      이름
                    </th>

                    <th className="px-4 py-3 text-left">
                      Instagram
                    </th>

                    <th className="px-4 py-3 text-left">
                      이메일
                    </th>

                    <th className="px-4 py-3 text-left">
                      카테고리
                    </th>

                    <th className="px-4 py-3 text-right">
                      팔로워
                    </th>

                    <th className="px-4 py-3 text-right">
                      평균 조회수
                    </th>

                    <th className="px-4 py-3 text-right">
                      협업 단가
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {mappedRows
                    .slice(0, 100)
                    .map((row, index) => (
                      <tr
                        key={`${row.instagram_id}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3">
                          {row.name || "-"}
                        </td>

                        <td className="px-4 py-3">
                          @{row.instagram_id}
                        </td>

                        <td className="px-4 py-3">
                          {row.email || "-"}
                        </td>

                        <td className="px-4 py-3">
                          {row.category || "-"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {row.followers?.toLocaleString() ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {row.avg_views?.toLocaleString() ||
                            "-"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatPriceMan(
                            row.collaboration_rate
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {mappedRows.length > 100 && (
              <div className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
                화면에는 처음 100개만 표시합니다. 실제 DB 반영 시에는 전체{" "}
                {mappedRows.length.toLocaleString()}
                개가 처리됩니다.
              </div>
            )}
          </section>

          <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
            <div>
              <p className="font-medium">
                DB 반영 준비 완료
              </p>

              <p className="mt-1 text-sm text-slate-500">
                기존 Instagram ID가 있으면 해당 인플루언서 정보를 업데이트합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={
                loading ||
                mappedRows.length === 0
              }
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? "DB 반영 중..."
                : `${mappedRows.length.toLocaleString()}개 DB에 추가하기`}
            </button>
          </section>
        </>
      )}

      {message && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {message}
        </div>
      )}
    </div>
  );
}