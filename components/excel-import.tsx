"use client";

import { useEffect, useMemo, useState } from "react";
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
  | "collaboration_rate"
  | "campaign_name"
  | "campaign_brand"
  | "campaign_product";

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
  campaign_name: string | null;
  campaign_brand: string | null;
  campaign_product: string | null;
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
  campaign_name: "",
  campaign_brand: "",
  campaign_product: "",
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
  campaign_name: "캠페인명",
  campaign_brand: "광고주 / 브랜드",
  campaign_product: "제품명",
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

  campaign_name: [
    "campaign",
    "campaign_name",
    "campaign name",
    "캠페인",
    "캠페인명",
    "프로젝트",
    "프로젝트명",
  ],

  campaign_brand: [
    "brand",
    "client",
    "advertiser",
    "광고주",
    "브랜드",
    "브랜드명",
    "클라이언트",
  ],

  campaign_product: [
    "product",
    "product_name",
    "product name",
    "제품",
    "제품명",
    "상품",
    "상품명",
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

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

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
  const [revertingId, setRevertingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");

  type ImportBatch = {
    id: string;
    file_name: string;
    file_size: number | null;
    uploaded_by: string | null;
    total_rows: number | null;
    inserted_rows: number | null;
    updated_rows: number | null;
    status: "processing" | "completed" | "reverted" | "failed";
    created_at: string;
    reverted_at: string | null;
    reverted_by: string | null;
    uploader_name?: string | null;
    uploader_email?: string | null;
  };

  type BatchItem = {
    id: string;
    batch_id: string;
    influencer_id: string | null;
    instagram_id: string;
    operation: "inserted" | "updated";
    before_data: Record<string, unknown> | null;
    imported_data: Record<string, unknown> | null;
  };

  const [batches, setBatches] =
    useState<ImportBatch[]>([]);
  const [currentUserId, setCurrentUserId] =
    useState<string>("");
  const [currentUserRole, setCurrentUserRole] =
    useState<string>("member");
  const [historyLoading, setHistoryLoading] =
    useState(true);

  const loadImportHistory = async () => {
    setHistoryLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId("");
      setCurrentUserRole("member");
      setBatches([]);
      setHistoryLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "member";
    setCurrentUserRole(role);

    const { data: batchRows, error: batchError } =
      await supabase
        .from("import_batches")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

    if (batchError) {
      console.error(batchError);
      setMessage(
        `업로드 이력 조회 실패: ${batchError.message}`
      );
      setBatches([]);
      setHistoryLoading(false);
      return;
    }

    const uploaderIds = Array.from(
      new Set(
        (batchRows ?? [])
          .map((batch) => batch.uploaded_by)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0
          )
      )
    );

    const profileMap = new Map<
      string,
      { name: string | null; email: string | null }
    >();

    if (uploaderIds.length > 0) {
      const { data: uploaderProfiles } =
        await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", uploaderIds);

      for (const uploader of uploaderProfiles ?? []) {
        profileMap.set(uploader.id, {
          name: uploader.name,
          email: uploader.email,
        });
      }
    }

    setBatches(
      (batchRows ?? []).map((batch) => {
        const uploader = batch.uploaded_by
          ? profileMap.get(batch.uploaded_by)
          : undefined;

        return {
          ...batch,
          uploader_name: uploader?.name ?? null,
          uploader_email: uploader?.email ?? null,
        } as ImportBatch;
      })
    );

    setHistoryLoading(false);
  };

  useEffect(() => {
    void loadImportHistory();
  }, []);

  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);
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
                  row[mapping.collaboration_rate]
                )
              : null,

          campaign_name: mapping.campaign_name
            ? normalizeText(row[mapping.campaign_name]) || null
            : null,

          campaign_brand: mapping.campaign_brand
            ? normalizeText(row[mapping.campaign_brand]) || null
            : null,

          campaign_product: mapping.campaign_product
            ? normalizeText(row[mapping.campaign_product]) || null
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
      setMessage("Instagram ID 컬럼을 먼저 지정해주세요.");
      return;
    }

    if (mappedRows.length === 0) {
      setMessage("업로드 가능한 인플루언서 데이터가 없습니다.");
      return;
    }

    if (!selectedFile) {
      setMessage("Excel 파일을 다시 선택해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    let batchId: string | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("로그인이 필요합니다.");
      }

      // 동일 Instagram ID가 여러 캠페인 때문에 여러 줄 있어도
      // influencers에는 한 번만 저장합니다. 마지막 행의 최신 정보를 사용합니다.
      const uniqueInfluencerRows = Array.from(
        new Map(
          mappedRows.map((row) => [
            row.instagram_id.toLowerCase(),
            row,
          ])
        ).values()
      );

      const influencerRowsForDb = uniqueInfluencerRows.map((row) => ({
        name: row.name,
        instagram_id: row.instagram_id,
        instagram_url: row.instagram_url,
        email: row.email,
        followers: row.followers,
        avg_views: row.avg_views,
        category: row.category,
        collaboration_rate: row.collaboration_rate,
      }));

      const { data: batch, error: batchError } =
        await supabase
          .from("import_batches")
          .insert({
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            uploaded_by: user.id,
            total_rows: mappedRows.length,
            inserted_rows: 0,
            updated_rows: 0,
            status: "processing",
          })
          .select("id")
          .single();

      if (batchError || !batch) {
        throw new Error(
          batchError?.message ??
            "업로드 기록을 생성하지 못했습니다."
        );
      }

      batchId = batch.id;

      const instagramIds = uniqueInfluencerRows.map(
        (row) => row.instagram_id
      );

      const { data: existingInfluencers, error: existingError } =
        await supabase
          .from("influencers")
          .select("*")
          .in("instagram_id", instagramIds);

      if (existingError) {
        throw new Error(existingError.message);
      }

      const existingMap = new Map<
        string,
        Record<string, unknown>
      >(
        (existingInfluencers ?? []).map((item) => [
          String(item.instagram_id).toLowerCase(),
          item as Record<string, unknown>,
        ])
      );

      const insertedCount = uniqueInfluencerRows.filter(
        (row) => !existingMap.has(row.instagram_id.toLowerCase())
      ).length;
      const updatedCount =
        uniqueInfluencerRows.length - insertedCount;

      const { data: savedInfluencers, error: upsertError } =
        await supabase
          .from("influencers")
          .upsert(influencerRowsForDb, {
            onConflict: "instagram_id",
          })
          .select("*");

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      const savedMap = new Map<
        string,
        Record<string, unknown>
      >(
        (savedInfluencers ?? []).map((item) => [
          String(item.instagram_id).toLowerCase(),
          item as Record<string, unknown>,
        ])
      );

      // Excel의 캠페인명을 기준으로 기존 캠페인을 찾고,
      // 없는 캠페인만 새로 생성합니다.
      const campaignMetaMap = new Map<
        string,
        {
          name: string;
          brand: string | null;
          product: string | null;
        }
      >();

      for (const row of mappedRows) {
        if (!row.campaign_name) continue;

        const key = row.campaign_name.trim().toLowerCase();
        const previous = campaignMetaMap.get(key);

        campaignMetaMap.set(key, {
          name: row.campaign_name.trim(),
          brand: row.campaign_brand ?? previous?.brand ?? null,
          product: row.campaign_product ?? previous?.product ?? null,
        });
      }

      const { data: existingCampaigns, error: campaignLoadError } =
        await supabase
          .from("campaigns")
          .select("id, name, brand, product");

      if (campaignLoadError) {
        throw new Error(
          `캠페인 조회 실패: ${campaignLoadError.message}`
        );
      }

      const campaignMap = new Map<
        string,
        { id: string; name: string }
      >(
        (existingCampaigns ?? []).map((campaign) => [
          String(campaign.name).trim().toLowerCase(),
          {
            id: campaign.id as string,
            name: campaign.name as string,
          },
        ])
      );

      const missingCampaignRows = Array.from(
        campaignMetaMap.entries()
      )
        .filter(([key]) => !campaignMap.has(key))
        .map(([, campaign]) => ({
          name: campaign.name,
          brand: campaign.brand,
          product: campaign.product,
          status: "completed",
        }));

      let createdCampaignIds: string[] = [];

      if (missingCampaignRows.length > 0) {
        const { data: createdCampaigns, error: campaignInsertError } =
          await supabase
            .from("campaigns")
            .insert(missingCampaignRows)
            .select("id, name");

        if (campaignInsertError) {
          throw new Error(
            `신규 캠페인 생성 실패: ${campaignInsertError.message}`
          );
        }

        createdCampaignIds = (createdCampaigns ?? []).map(
          (campaign) => campaign.id as string
        );

        for (const campaign of createdCampaigns ?? []) {
          campaignMap.set(
            String(campaign.name).trim().toLowerCase(),
            {
              id: campaign.id as string,
              name: campaign.name as string,
            }
          );
        }
      }

      // 같은 인플루언서가 여러 캠페인에 등장하는 경우
      // campaign_influencers에 캠페인별로 각각 연결합니다.
      const campaignLinkMap = new Map<
        string,
        {
          campaign_id: string;
          influencer_id: string;
          status: string;
          final_rate: number | null;
        }
      >();

      for (const row of mappedRows) {
        if (!row.campaign_name) continue;

        const saved = savedMap.get(
          row.instagram_id.toLowerCase()
        );
        const influencerId =
          typeof saved?.id === "string" ? saved.id : null;
        const campaign = campaignMap.get(
          row.campaign_name.trim().toLowerCase()
        );

        if (!influencerId || !campaign) continue;

        const key = `${campaign.id}::${influencerId}`;
        campaignLinkMap.set(key, {
          campaign_id: campaign.id,
          influencer_id: influencerId,
          status: "candidate",
          final_rate: row.collaboration_rate,
        });
      }

      const campaignLinks = Array.from(campaignLinkMap.values());
      const createdLinkCampaignIdsByInfluencer =
        new Map<string, string[]>();

      if (campaignLinks.length > 0) {
        const campaignIds = Array.from(
          new Set(campaignLinks.map((row) => row.campaign_id))
        );
        const influencerIds = Array.from(
          new Set(campaignLinks.map((row) => row.influencer_id))
        );

        const { data: existingLinks, error: existingLinksError } =
          await supabase
            .from("campaign_influencers")
            .select("campaign_id, influencer_id")
            .in("campaign_id", campaignIds)
            .in("influencer_id", influencerIds);

        if (existingLinksError) {
          throw new Error(
            `캠페인 연결 조회 실패: ${existingLinksError.message}`
          );
        }

        const existingLinkKeys = new Set(
          (existingLinks ?? []).map(
            (row) => `${row.campaign_id}::${row.influencer_id}`
          )
        );

        const newLinks = campaignLinks.filter(
          (row) =>
            !existingLinkKeys.has(
              `${row.campaign_id}::${row.influencer_id}`
            )
        );

        if (newLinks.length > 0) {
          const { error: linkInsertError } =
            await supabase
              .from("campaign_influencers")
              .insert(newLinks);

          if (linkInsertError) {
            throw new Error(
              `캠페인 인플루언서 연결 실패: ${linkInsertError.message}`
            );
          }

          for (const link of newLinks) {
            const current =
              createdLinkCampaignIdsByInfluencer.get(
                link.influencer_id
              ) ?? [];
            current.push(link.campaign_id);
            createdLinkCampaignIdsByInfluencer.set(
              link.influencer_id,
              current
            );
          }
        }
      }

      const batchItems = uniqueInfluencerRows.map((row, index) => {
        const existing = existingMap.get(
          row.instagram_id.toLowerCase()
        );
        const saved = savedMap.get(
          row.instagram_id.toLowerCase()
        );
        const influencerId =
          typeof saved?.id === "string" ? saved.id : null;

        const relatedCampaigns = mappedRows
          .filter(
            (item) =>
              item.instagram_id.toLowerCase() ===
              row.instagram_id.toLowerCase()
          )
          .filter((item) => item.campaign_name)
          .map((item) => ({
            campaign_name: item.campaign_name,
            collaboration_rate: item.collaboration_rate,
          }));

        return {
          batch_id: batchId,
          influencer_id: influencerId,
          instagram_id: row.instagram_id,
          operation: existing ? "updated" : "inserted",
          before_data: existing ?? null,
          imported_data: {
            ...row,
            campaign_history: relatedCampaigns,
            __import_meta: {
              created_link_campaign_ids: influencerId
                ? createdLinkCampaignIdsByInfluencer.get(
                    influencerId
                  ) ?? []
                : [],
              created_campaign_ids:
                index === 0 ? createdCampaignIds : [],
            },
          },
        };
      });

      const { error: itemError } =
        await supabase
          .from("import_batch_items")
          .insert(batchItems);

      if (itemError) {
        throw new Error(
          `업로드 내역 저장 실패: ${itemError.message}`
        );
      }

      const { error: completeError } =
        await supabase
          .from("import_batches")
          .update({
            status: "completed",
            inserted_rows: insertedCount,
            updated_rows: updatedCount,
          })
          .eq("id", batchId);

      if (completeError) {
        throw new Error(
          `업로드 완료 상태 저장 실패: ${completeError.message}`
        );
      }

      const duplicateCount =
        mappedRows.length - uniqueInfluencerRows.length;

      setMessage(
        `Excel ${mappedRows.length.toLocaleString()}행을 처리해 ${uniqueInfluencerRows.length.toLocaleString()}명의 인플루언서를 DB에 반영했습니다. 신규 ${insertedCount.toLocaleString()}명, 기존 업데이트 ${updatedCount.toLocaleString()}명, 중복 행 ${duplicateCount.toLocaleString()}개 병합, 신규 캠페인 ${createdCampaignIds.length.toLocaleString()}개 생성, 캠페인 연결 ${campaignLinks.length.toLocaleString()}건을 확인했습니다.`
      );

      await loadImportHistory();
      router.refresh();
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "DB 반영 중 오류가 발생했습니다.";

      if (batchId) {
        await supabase
          .from("import_batches")
          .update({ status: "failed" })
          .eq("id", batchId);
      }

      setMessage(`DB 반영 실패: ${errorMessage}`);
      await loadImportHistory();
    } finally {
      setLoading(false);
    }
  };

  const canRevertBatch = (
    batch: ImportBatch
  ) => {
    return (
      currentUserRole === "owner" ||
      currentUserRole === "admin" ||
      batch.uploaded_by === currentUserId
    );
  };

  const handleRevert = async (
    batch: ImportBatch
  ) => {
    if (batch.status !== "completed") {
      return;
    }

    if (!canRevertBatch(batch)) {
      setMessage(
        "이 업로드를 되돌릴 권한이 없습니다."
      );
      return;
    }

    const confirmed = window.confirm(
      `${batch.file_name} 업로드를 되돌리시겠습니까?\n\n신규 등록된 인플루언서는 삭제되고, 기존 인플루언서는 업로드 이전 값으로 복원됩니다.\n\n캠페인에 연결된 신규 인플루언서가 있다면 관련 데이터에도 영향을 줄 수 있습니다.`
    );

    if (!confirmed) return;

    setRevertingId(batch.id);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("로그인이 필요합니다.");
      }

      const { data: profile } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      const role = profile?.role ?? "member";

      const allowed =
        role === "owner" ||
        role === "admin" ||
        batch.uploaded_by === user.id;

      if (!allowed) {
        throw new Error(
          "이 업로드를 되돌릴 권한이 없습니다."
        );
      }

      const { data: items, error: itemError } =
        await supabase
          .from("import_batch_items")
          .select("*")
          .eq("batch_id", batch.id)
          .order("created_at", {
            ascending: false,
          });

      if (itemError) {
        throw new Error(itemError.message);
      }

      if (!items || items.length === 0) {
        throw new Error(
          "이 업로드에 연결된 상세 기록이 없습니다."
        );
      }

      const insertedItems = (
        items as BatchItem[]
      ).filter(
        (item) => item.operation === "inserted"
      );

      const updatedItems = (
        items as BatchItem[]
      ).filter(
        (item) => item.operation === "updated"
      );

      const createdCampaignIds = Array.from(
        new Set(
          (items as BatchItem[]).flatMap((item) => {
            const meta = (
              item.imported_data as {
                __import_meta?: {
                  created_campaign_ids?: string[];
                };
              } | null
            )?.__import_meta;

            return meta?.created_campaign_ids ?? [];
          })
        )
      );

      for (const item of items as BatchItem[]) {
        if (!item.influencer_id) continue;

        const meta = (
          item.imported_data as {
            __import_meta?: {
              created_link_campaign_ids?: string[];
            };
          } | null
        )?.__import_meta;

        const campaignIds =
          meta?.created_link_campaign_ids ?? [];

        if (campaignIds.length === 0) continue;

        const { error: linkDeleteError } =
          await supabase
            .from("campaign_influencers")
            .delete()
            .eq("influencer_id", item.influencer_id)
            .in("campaign_id", campaignIds);

        if (linkDeleteError) {
          throw new Error(
            `캠페인 연결 되돌리기 실패: ${linkDeleteError.message}`
          );
        }
      }

      // 기존 인플루언서는 업로드 직전 값으로 복원
      for (const item of updatedItems) {
        if (
          !item.influencer_id ||
          !item.before_data
        ) {
          continue;
        }

        const restoreData = {
          ...item.before_data,
        };

        delete restoreData.id;
        delete restoreData.created_at;
        delete restoreData.updated_at;

        const { error: restoreError } =
          await supabase
            .from("influencers")
            .update(restoreData)
            .eq("id", item.influencer_id);

        if (restoreError) {
          throw new Error(
            `@${item.instagram_id} 복원 실패: ${restoreError.message}`
          );
        }
      }

      // 해당 Excel 업로드에서 새로 생긴 인플루언서는 삭제
      for (const item of insertedItems) {
        let deleteQuery = supabase
          .from("influencers")
          .delete();

        if (item.influencer_id) {
          deleteQuery = deleteQuery.eq(
            "id",
            item.influencer_id
          );
        } else {
          deleteQuery = deleteQuery.eq(
            "instagram_id",
            item.instagram_id
          );
        }

        const { error: deleteError } =
          await deleteQuery;

        if (deleteError) {
          throw new Error(
            `@${item.instagram_id} 삭제 실패: ${deleteError.message}`
          );
        }
      }

      for (const campaignId of createdCampaignIds) {
        const { count, error: countError } =
          await supabase
            .from("campaign_influencers")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("campaign_id", campaignId);

        if (countError) {
          throw new Error(
            `신규 캠페인 정리 확인 실패: ${countError.message}`
          );
        }

        if ((count ?? 0) === 0) {
          const { error: campaignDeleteError } =
            await supabase
              .from("campaigns")
              .delete()
              .eq("id", campaignId);

          if (campaignDeleteError) {
            throw new Error(
              `신규 캠페인 되돌리기 실패: ${campaignDeleteError.message}`
            );
          }
        }
      }

      const { error: batchUpdateError } =
        await supabase
          .from("import_batches")
          .update({
            status: "reverted",
            reverted_at:
              new Date().toISOString(),
            reverted_by: user.id,
          })
          .eq("id", batch.id)
          .eq("status", "completed");

      if (batchUpdateError) {
        throw new Error(
          `Revert 상태 저장 실패: ${batchUpdateError.message}`
        );
      }

      setMessage(
        `${batch.file_name} 업로드를 되돌렸습니다. 신규 ${insertedItems.length.toLocaleString()}명 삭제, 기존 ${updatedItems.length.toLocaleString()}명 복원을 시도했습니다.`
      );

      await loadImportHistory();
      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? `Revert 실패: ${error.message}`
          : "Revert 중 오류가 발생했습니다."
      );
    } finally {
      setRevertingId(null);
    }
  };

  const formatDateTime = (
    value: string | null
  ) => {
    if (!value) return "-";

    return new Date(value).toLocaleString(
      "ko-KR"
    );
  };

  const formatFileSize = (
    size: number | null
  ) => {
    if (size === null) return "-";

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };

  const statusLabel = (
    status: ImportBatch["status"]
  ) => {
    const labels = {
      processing: "처리 중",
      completed: "완료",
      reverted: "되돌림",
      failed: "실패",
    };

    return labels[status];
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

                    <th className="px-4 py-3 text-left">
                      캠페인
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

                        <td className="px-4 py-3">
                          {row.campaign_name || "-"}
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
                같은 Instagram ID가 여러 행에 있어도 인플루언서는 1명으로 병합합니다. 캠페인명이 있으면 기존 캠페인과 연결하고, 없는 캠페인은 자동 생성합니다.
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

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="flex items-center justify-between border-b border-slate-300 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">
              최근 Excel 업로드
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Member는 본인이 올린 파일을 되돌릴 수 있고, Admin / Owner는 모든 업로드를 되돌릴 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadImportHistory()
            }
            disabled={historyLoading}
            className="rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            새로고침
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b-2 border-slate-400 bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left">
                  파일명
                </th>
                <th className="px-4 py-3 text-left">
                  업로드자
                </th>
                <th className="px-4 py-3 text-right">
                  전체
                </th>
                <th className="px-4 py-3 text-right">
                  신규
                </th>
                <th className="px-4 py-3 text-right">
                  수정
                </th>
                <th className="px-4 py-3 text-left">
                  상태
                </th>
                <th className="px-4 py-3 text-left">
                  업로드 시간
                </th>
                <th className="px-4 py-3 text-left">
                  작업
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {historyLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    업로드 이력을 불러오는 중입니다.
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    아직 Excel 업로드 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const canRevert =
                    canRevertBatch(batch);

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {batch.file_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatFileSize(
                            batch.file_size
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div>
                          {batch.uploader_name ||
                            batch.uploader_email ||
                            "-"}
                        </div>

                        {batch.uploader_name &&
                          batch.uploader_email && (
                            <div className="mt-1 text-xs text-slate-500">
                              {batch.uploader_email}
                            </div>
                          )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {(
                          batch.total_rows ?? 0
                        ).toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {(
                          batch.inserted_rows ?? 0
                        ).toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right">
                        {(
                          batch.updated_rows ?? 0
                        ).toLocaleString()}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                          {statusLabel(
                            batch.status
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatDateTime(
                          batch.created_at
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {batch.status ===
                          "completed" &&
                        canRevert ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRevert(
                                batch
                              )
                            }
                            disabled={
                              revertingId ===
                              batch.id
                            }
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                          >
                            {revertingId ===
                            batch.id
                              ? "되돌리는 중..."
                              : "되돌리기"}
                          </button>
                        ) : batch.status ===
                          "reverted" ? (
                          <div className="text-xs text-slate-500">
                            {formatDateTime(
                              batch.reverted_at
                            )}
                          </div>
                        ) : batch.status ===
                            "completed" &&
                          !canRevert ? (
                          <span className="text-xs text-slate-400">
                            다른 사용자의 업로드
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
