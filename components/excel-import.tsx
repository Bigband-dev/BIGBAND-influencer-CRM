"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPriceMan } from "@/lib/format-number";

type RawRow = Record<string, unknown>;

type FieldKey =
  | "campaign_brand"
  | "campaign_product"
  | "campaign_name"
  | "platform"
  | "channel_handle"
  | "channel_name"
  | "category"
  | "content_format"
  | "channel_url"
  | "content_reference"
  | "followers"
  | "avg_views"
  | "contact_point"
  | "rate_feed"
  | "rate_reels"
  | "rate_story"
  | "rate_bdc"
  | "rate_ppl"
  | "rate_shorts"
  | "rate_other"
  | "note";

type Mapping = Record<FieldKey, string>;

type NumberUnit =
  | "auto"
  | "one"
  | "thousand"
  | "ten_thousand";

type InfluencerPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "naver_blog"
  | "xiaohongshu";

type ImportRow = {
  campaign_brand: string | null;
  campaign_product: string | null;
  campaign_name: string | null;
  platform: InfluencerPlatform | null;
  channel_handle: string;
  channel_name: string | null;
  category: string | null;
  content_format: string | null;
  channel_url: string | null;
  content_reference: string | null;
  followers: number | null;
  avg_views: number | null;
  contact_point: string | null;
  rate_feed: number | null;
  rate_reels: number | null;
  rate_story: number | null;
  rate_bdc: number | null;
  rate_ppl: number | null;
  rate_shorts: number | null;
  rate_other: number | null;
  note: string | null;
};

const EMPTY_MAPPING: Mapping = {
  campaign_brand: "",
  campaign_product: "",
  campaign_name: "",
  platform: "",
  channel_handle: "",
  channel_name: "",
  category: "",
  content_format: "",
  channel_url: "",
  content_reference: "",
  followers: "",
  avg_views: "",
  contact_point: "",
  rate_feed: "",
  rate_reels: "",
  rate_story: "",
  rate_bdc: "",
  rate_ppl: "",
  rate_shorts: "",
  rate_other: "",
  note: "",
};

const FIELD_LABELS: Record<FieldKey, string> = {
  campaign_brand: "광고주",
  campaign_product: "제품",
  campaign_name: "캠페인",
  platform: "채널",
  channel_handle: "아이디",
  channel_name: "계정명",
  category: "카테고리",
  content_format: "콘텐츠 포맷",
  channel_url: "계정 URL",
  content_reference: "콘텐츠 레퍼런스",
  followers: "팔로워 수",
  avg_views: "평균 조회 수",
  contact_point: "컨택포인트",
  rate_feed: "피드 클린 단가 (만 원)",
  rate_reels: "릴스 클린 단가 (만 원)",
  rate_story: "스토리 클린 단가 (만 원)",
  rate_bdc: "BDC 클린 단가 (만 원)",
  rate_ppl: "PPL 클린 단가 (만 원)",
  rate_shorts: "쇼츠 클린 단가 (만 원)",
  rate_other: "기타 클린 단가 (만 원)",
  note: "비고",
};

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  campaign_brand: [
    "광고주", "brand", "client", "advertiser", "브랜드", "브랜드명", "클라이언트",
  ],
  campaign_product: [
    "제품", "제품명", "product", "product_name", "product name", "상품", "상품명",
  ],
  campaign_name: [
    "캠페인", "캠페인명", "campaign", "campaign_name", "campaign name", "프로젝트", "프로젝트명",
  ],
  platform: [
    "채널", "platform", "플랫폼", "채널유형", "채널 유형", "매체", "매체구분", "sns", "sns유형",
  ],
  channel_handle: [
    "아이디", "id", "handle", "channel_id", "channel id", "채널id", "채널 id", "계정id", "계정 id",
    "instagram_id", "instagram id", "인스타그램id", "인스타그램 id", "인스타 id",
    "youtube_id", "youtube id", "유튜브 id", "틱톡 id", "블로그 id",
  ],
  channel_name: [
    "계정명", "channel_name", "channel name", "채널명", "블로그명", "유튜브채널명",
  ],
  category: [
    "카테고리", "category", "분류",
  ],
  content_format: [
    "콘텐츠포맷", "콘텐츠 포맷", "contentformat", "content format", "format", "광고포맷", "광고 포맷",
  ],
  channel_url: [
    "계정url", "계정 url", "url", "channel_url", "channel url", "채널url", "채널 url", "링크", "sns url",
    "instagram_url", "instagram url", "인스타그램 url", "인스타 url",
    "youtube_url", "youtube url", "유튜브 url", "tiktok url", "틱톡 url",
    "blog url", "블로그 url", "네이버블로그 url", "xiaohongshu url", "샤오홍슈 url",
  ],
  content_reference: [
    "콘텐츠레퍼런스", "콘텐츠 레퍼런스", "레퍼런스", "reference", "contentreference", "content reference",
    "콘텐츠url", "콘텐츠 url", "게시물url", "게시물 url",
  ],
  followers: [
    "팔로워수", "팔로워 수", "followers", "follower", "subscribers", "subscriber",
    "팔로워", "구독자", "구독자수", "구독자 수", "이웃수", "이웃 수",
  ],
  avg_views: [
    "평균조회수", "평균 조회 수", "평균 조회수", "avg_views", "average views", "조회수",
    "평균 릴스 조회수", "릴스 평균 조회수", "평균 영상 조회수",
  ],
  contact_point: [
    "컨택포인트", "컨택 포인트", "contact", "contactpoint", "contact point",
    "email", "e-mail", "메일", "이메일", "이메일 주소", "연락처",
  ],
  rate_feed: [
    "피드클린단가", "피드 클린 단가", "igfeed", "instagramfeed", "feedrate", "feed rate", "피드단가", "피드 단가",
  ],
  rate_reels: [
    "릴스클린단가", "릴스 클린 단가", "igreels", "instagramreels", "reelsrate", "reels rate", "릴스단가", "릴스 단가",
  ],
  rate_story: [
    "스토리클린단가", "스토리 클린 단가", "igstory", "instagramstory", "storyrate", "story rate", "스토리단가", "스토리 단가",
  ],
  rate_bdc: [
    "bdc클린단가", "bdc 클린 단가", "ytbdc", "youtubebdc", "bdcrate", "bdc rate", "bdc단가", "bdc 단가",
  ],
  rate_ppl: [
    "ppl클린단가", "ppl 클린 단가", "ytppl", "youtubeppl", "pplrate", "ppl rate", "ppl단가", "ppl 단가",
  ],
  rate_shorts: [
    "쇼츠클린단가", "쇼츠 클린 단가", "shorts클린단가", "shorts 클린 단가",
    "ytshorts", "youtubeshorts", "shortsrate", "shorts rate", "쇼츠단가", "쇼츠 단가",
  ],
  rate_other: [
    "기타클린단가", "기타 클린 단가", "otherrate", "other rate", "기타단가", "기타 단가",
  ],
  note: [
    "비고", "memo", "note", "notes", "메모", "특이사항",
  ],
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/<br\s*\/?\s*>/gi, "")
    .replace(/만\s*원/g, "")
    .replace(/[()\[\]{}]/g, "")
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

function contactPointToEmail(value: string | null) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? null;
}

function contactPointToPhone(value: string | null) {
  if (!value) return null;
  const compact = value.replace(/[^0-9+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return value.trim();
}

function buildImportMemo(
  existingMemo: string | null | undefined,
  contactPoint: string | null,
  note: string | null
) {
  const lines: string[] = [];

  if (existingMemo?.trim()) {
    lines.push(existingMemo.trim());
  }

  if (
    contactPoint &&
    !contactPointToEmail(contactPoint) &&
    !contactPointToPhone(contactPoint)
  ) {
    lines.push(`컨택포인트: ${contactPoint}`);
  }

  if (note) {
    lines.push(`비고: ${note}`);
  }

  return lines.length > 0
    ? Array.from(new Set(lines)).join("\n")
    : null;
}

function buildCampaignMemo(row: ImportRow) {
  const lines: string[] = [];

  if (row.content_format) {
    lines.push(`콘텐츠 포맷: ${row.content_format}`);
  }

  if (row.content_reference) {
    lines.push(`콘텐츠 레퍼런스: ${row.content_reference}`);
  }

  if (row.note) {
    lines.push(`비고: ${row.note}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function getRateEntries(row: ImportRow) {
  if (!row.platform) return [];

  const entries: Array<{ content_type: string; rate: number | null }> = [];

  if (row.platform === "instagram") {
    entries.push(
      { content_type: "feed", rate: row.rate_feed },
      { content_type: "reels", rate: row.rate_reels },
      { content_type: "story", rate: row.rate_story }
    );
  }

  if (row.platform === "youtube") {
    entries.push(
      { content_type: "bdc", rate: row.rate_bdc },
      { content_type: "ppl", rate: row.rate_ppl },
      { content_type: "shorts", rate: row.rate_shorts }
    );
  }

  if (row.rate_other != null) {
    const otherType =
      row.platform === "naver_blog"
        ? "post"
        : row.platform === "tiktok"
          ? "video"
          : "other";

    entries.push({
      content_type: otherType,
      rate: row.rate_other,
    });
  }

  return entries.filter((entry) => entry.rate != null);
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

const PLATFORM_MAP: Record<string, InfluencerPlatform> = {
  instagram: "instagram",
  ig: "instagram",
  인스타: "instagram",
  인스타그램: "instagram",

  youtube: "youtube",
  yt: "youtube",
  유튜브: "youtube",

  tiktok: "tiktok",
  tt: "tiktok",
  틱톡: "tiktok",

  naverblog: "naver_blog",
  naver_blog: "naver_blog",
  "naver blog": "naver_blog",
  nb: "naver_blog",
  네이버블로그: "naver_blog",
  블로그: "naver_blog",
  blog: "naver_blog",

  xiaohongshu: "xiaohongshu",
  xhs: "xiaohongshu",
  red: "xiaohongshu",
  샤오홍슈: "xiaohongshu",
  小红书: "xiaohongshu",
};

function normalizePlatformValue(value: unknown): InfluencerPlatform | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "_");

  return PLATFORM_MAP[normalized] ?? null;
}

function detectPlatformFromUrl(value: unknown): InfluencerPlatform | null {
  const url = normalizeText(value).toLowerCase();
  if (!url) return null;
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("blog.naver.com")) return "naver_blog";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com")) return "xiaohongshu";
  return null;
}

function detectPlatformFromMappedHeader(
  handleHeader: string,
  urlHeader: string
): InfluencerPlatform | null {
  const header = `${handleHeader} ${urlHeader}`.toLowerCase();
  if (header.includes("instagram") || header.includes("인스타")) return "instagram";
  if (header.includes("youtube") || header.includes("유튜브")) return "youtube";
  if (header.includes("tiktok") || header.includes("틱톡")) return "tiktok";
  if (header.includes("naver") || header.includes("네이버") || header.includes("블로그")) {
    return "naver_blog";
  }
  if (header.includes("xiaohongshu") || header.includes("샤오홍슈") || header.includes("red")) {
    return "xiaohongshu";
  }
  return null;
}

function extractChannelHandle(
  value: unknown,
  platform: InfluencerPlatform | null
) {
  let text = normalizeText(value);
  if (!text) return "";

  text = text.replace(/^@/, "").trim();

  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
    try {
      const normalizedUrl = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      const url = new URL(normalizedUrl);
      const parts = url.pathname.split("/").filter(Boolean);

      if (platform === "instagram" || platform === "tiktok") {
        return (parts[0] || "").replace(/^@/, "");
      }

      if (platform === "youtube") {
        const part = parts.find((p) => p.startsWith("@"));
        return part ? part.replace(/^@/, "") : parts[0] || "";
      }

      if (platform === "naver_blog") {
        return parts[0] || "";
      }

      return parts[0] || "";
    } catch {
      return text;
    }
  }

  return text;
}

function buildChannelUrl(
  platform: InfluencerPlatform | null,
  handle: string,
  explicitUrl: string
) {
  if (explicitUrl) return explicitUrl;
  if (!platform || !handle) return null;

  if (platform === "instagram") return `https://www.instagram.com/${handle}/`;
  if (platform === "youtube") return `https://www.youtube.com/@${handle}`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (platform === "naver_blog") return `https://blog.naver.com/${handle}`;
  return null;
}




function chunkArray<T>(items: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}


function normalizeCampaignKeyPart(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function campaignIdentityKey({
  name,
  brand,
  product,
}: {
  name: string | null | undefined;
  brand: string | null | undefined;
  product: string | null | undefined;
}) {
  return [
    normalizeCampaignKeyPart(brand),
    normalizeCampaignKeyPart(product),
    normalizeCampaignKeyPart(name),
  ].join("::");
}


type InvalidImportRow = {
  excelRow: number;
  reason: string;
  platformRaw: string;
  handleRaw: string;
  channelNameRaw: string;
  urlRaw: string;
};

function analyzeImportRowValidity(
  row: RawRow,
  mapping: Mapping,
  excelRow: number
): InvalidImportRow | null {
  const platformRaw = mapping.platform
    ? normalizeText(row[mapping.platform])
    : "";

  const urlRaw = mapping.channel_url
    ? normalizeText(row[mapping.channel_url])
    : "";

  const channelNameRaw = mapping.channel_name
    ? normalizeText(row[mapping.channel_name])
    : "";

  const handleSource = mapping.channel_handle
    ? row[mapping.channel_handle]
    : urlRaw;

  const handleRaw = normalizeText(handleSource);

  const explicitPlatform = mapping.platform
    ? normalizePlatformValue(row[mapping.platform])
    : null;

  const platform =
    explicitPlatform ??
    detectPlatformFromUrl(urlRaw) ??
    detectPlatformFromMappedHeader(
      mapping.channel_handle,
      mapping.channel_url
    );

  const channelHandle =
    extractChannelHandle(handleSource, platform);

  const channelUrl = buildChannelUrl(
    platform,
    channelHandle,
    urlRaw
  );

  const reasons: string[] = [];

  if (!platform) {
    reasons.push(
      platformRaw
        ? `채널 값 인식 불가 (${platformRaw})`
        : "채널/플랫폼 정보 없음"
    );
  }

  if (!channelHandle && !channelUrl) {
    reasons.push("아이디와 계정 URL이 모두 없음");
  }

  if (!channelNameRaw && !channelHandle) {
    reasons.push("계정명과 아이디가 모두 없음");
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    excelRow,
    reason: reasons.join(" / "),
    platformRaw,
    handleRaw,
    channelNameRaw,
    urlRaw,
  };
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
        const explicitPlatform = mapping.platform
          ? normalizePlatformValue(row[mapping.platform])
          : null;

        const rawUrl = mapping.channel_url
          ? normalizeText(row[mapping.channel_url])
          : "";

        const platform =
          explicitPlatform ??
          detectPlatformFromUrl(rawUrl) ??
          detectPlatformFromMappedHeader(
            mapping.channel_handle,
            mapping.channel_url
          );

        const handleSource = mapping.channel_handle
          ? row[mapping.channel_handle]
          : rawUrl;

        const channelHandle =
          extractChannelHandle(handleSource, platform);

        const channelUrl = buildChannelUrl(
          platform,
          channelHandle,
          rawUrl
        );

        return {
          platform,

          channel_name: mapping.channel_name
            ? normalizeText(row[mapping.channel_name]) || null
            : null,

          channel_handle: channelHandle,

          channel_url: channelUrl,

          campaign_brand: mapping.campaign_brand
            ? normalizeText(row[mapping.campaign_brand]) || null
            : null,

          campaign_product: mapping.campaign_product
            ? normalizeText(row[mapping.campaign_product]) || null
            : null,

          campaign_name: mapping.campaign_name
            ? normalizeText(row[mapping.campaign_name]) || null
            : null,

          category: mapping.category
            ? normalizeText(row[mapping.category]) || null
            : null,

          content_format: mapping.content_format
            ? normalizeText(row[mapping.content_format]) || null
            : null,

          content_reference: mapping.content_reference
            ? normalizeText(row[mapping.content_reference]) || null
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

          contact_point: mapping.contact_point
            ? normalizeText(row[mapping.contact_point]) || null
            : null,

          rate_feed: mapping.rate_feed
            ? normalizeNumber(row[mapping.rate_feed])
            : null,

          rate_reels: mapping.rate_reels
            ? normalizeNumber(row[mapping.rate_reels])
            : null,

          rate_story: mapping.rate_story
            ? normalizeNumber(row[mapping.rate_story])
            : null,

          rate_bdc: mapping.rate_bdc
            ? normalizeNumber(row[mapping.rate_bdc])
            : null,

          rate_ppl: mapping.rate_ppl
            ? normalizeNumber(row[mapping.rate_ppl])
            : null,

          rate_shorts: mapping.rate_shorts
            ? normalizeNumber(row[mapping.rate_shorts])
            : null,

          rate_other: mapping.rate_other
            ? normalizeNumber(row[mapping.rate_other])
            : null,

          note: mapping.note
            ? normalizeText(row[mapping.note]) || null
            : null,
        };
      })
      .filter(
        (row) =>
          row.platform &&
          (row.channel_handle || row.channel_url) &&
          (row.channel_name || row.channel_handle)
      );
  }, [
    rawRows,
    mapping,
    followersUnit,
    viewsUnit,
  ]);

  const invalidRows = useMemo(() => {
    return rawRows
      .map((row, index) =>
        analyzeImportRowValidity(
          row,
          mapping,
          index + 2
        )
      )
      .filter(
        (item): item is InvalidImportRow =>
          item !== null
      );
  }, [rawRows, mapping]);

  const invalidCount = invalidRows.length;

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
    if (mappedRows.length === 0) {
      setMessage(
        "업로드 가능한 데이터가 없습니다. 플랫폼 또는 채널 ID/URL 매핑을 확인해주세요."
      );
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

      // Excel 양식에는 실명 컬럼이 없으므로
      // 플랫폼 + 아이디(핸들)를 채널 식별키로 사용합니다.
      const personKey = (row: ImportRow) =>
        `channel::${row.platform}::${row.channel_handle.toLowerCase()}`;

      const personRowsMap = new Map<string, ImportRow[]>();

      for (const row of mappedRows) {
        const key = personKey(row);
        const current = personRowsMap.get(key) ?? [];
        current.push(row);
        personRowsMap.set(key, current);
      }

      setMessage("1/5 기존 데이터 확인 중...");

      const handles = Array.from(
        new Set(
          mappedRows
            .map((row) => row.channel_handle)
            .filter(Boolean)
        )
      );

      /*
       * 기존 채널을 묶음 조회합니다.
       * 기존 버전처럼 인플루언서마다 추가 select를 보내지 않습니다.
       */
      const existingChannels: any[] = [];

      for (const handleChunk of chunkArray(handles, 200)) {
        const { data, error } = await supabase
          .from("influencer_channels")
          .select(
            "id, influencer_id, platform, channel_name, handle, url, followers, avg_views, collaboration_rate, is_primary, memo"
          )
          .in("handle", handleChunk);

        if (error) {
          throw new Error(
            `기존 채널 조회 실패: ${error.message}${
              error.details ? ` / ${error.details}` : ""
            }`
          );
        }

        existingChannels.push(...(data ?? []));
      }

      const existingChannelMap = new Map(
        existingChannels.map((channel) => [
          `${channel.platform}::${String(
            channel.handle ?? ""
          ).toLowerCase()}`,
          channel,
        ])
      );

      /*
       * 기존 채널이 가리키는 influencer를 한 번에 가져옵니다.
       * 예전 코드는 채널마다 .single()을 호출해 대량 업로드 시 매우 느렸습니다.
       */
      const existingInfluencerIds = Array.from(
        new Set(
          existingChannels
            .map((channel) => channel.influencer_id)
            .filter(Boolean)
        )
      );

      const existingInfluencers: any[] = [];

      for (const idChunk of chunkArray(
        existingInfluencerIds,
        200
      )) {
        const { data, error } = await supabase
          .from("influencers")
          .select("*")
          .in("id", idChunk);

        if (error) {
          throw new Error(
            `기존 인플루언서 조회 실패: ${error.message}`
          );
        }

        existingInfluencers.push(...(data ?? []));
      }

      const existingInfluencerMap = new Map(
        existingInfluencers.map((item) => [
          item.id,
          item,
        ])
      );

      const personIdMap = new Map<string, string>();
      const insertedInfluencerIds = new Set<string>();
      const beforeInfluencerMap = new Map<
        string,
        Record<string, unknown> | null
      >();

      /*
       * 신규 ID는 브라우저에서 UUID를 미리 생성합니다.
       * 그래서 신규/기존을 모두 한 번의 bulk upsert 흐름으로 저장할 수 있습니다.
       */
      const influencerPayloadMap = new Map<
        string,
        Record<string, any>
      >();

      for (const [key, rows] of personRowsMap) {
        const latest = rows[rows.length - 1];
        const instagramRow = rows.find(
          (row) => row.platform === "instagram"
        );

        let existing: Record<string, any> | null = null;

        for (const row of rows) {
          const channel = existingChannelMap.get(
            `${row.platform}::${row.channel_handle.toLowerCase()}`
          );

          if (channel?.influencer_id) {
            existing =
              existingInfluencerMap.get(
                channel.influencer_id
              ) ?? null;

            if (existing) break;
          }
        }

        const influencerId =
          existing?.id ?? crypto.randomUUID();

        personIdMap.set(key, influencerId);

        if (existing?.id) {
          beforeInfluencerMap.set(
            influencerId,
            existing as Record<string, unknown>
          );
        } else {
          insertedInfluencerIds.add(influencerId);
          beforeInfluencerMap.set(influencerId, null);
        }

        const payload = {
          id: influencerId,
          name:
            latest.channel_name ??
            latest.channel_handle,
          email:
            rows
              .map((row) =>
                contactPointToEmail(row.contact_point)
              )
              .find(Boolean) ??
            existing?.email ??
            null,
          phone:
            rows
              .map((row) =>
                contactPointToPhone(row.contact_point)
              )
              .find(Boolean) ??
            existing?.phone ??
            null,
          category:
            rows.find((row) => row.category)?.category ??
            existing?.category ??
            null,
          memo: buildImportMemo(
            existing?.memo ?? null,
            rows.find((row) => row.contact_point)
              ?.contact_point ?? null,
            rows.find((row) => row.note)?.note ?? null
          ),
          instagram_id:
            instagramRow?.channel_handle ||
            existing?.instagram_id ||
            null,
          instagram_url:
            instagramRow?.channel_url ||
            existing?.instagram_url ||
            null,
          followers:
            latest.followers ??
            existing?.followers ??
            null,
          avg_views:
            latest.avg_views ??
            existing?.avg_views ??
            null,
          collaboration_rate:
            existing?.collaboration_rate ?? null,
        };

        influencerPayloadMap.set(
          influencerId,
          payload
        );
      }

      setMessage(
        `2/5 인플루언서 ${influencerPayloadMap.size.toLocaleString()}명 일괄 저장 중...`
      );

      const influencerPayloads = Array.from(
        influencerPayloadMap.values()
      );

      for (const payloadChunk of chunkArray(
        influencerPayloads,
        200
      )) {
        const { error } = await supabase
          .from("influencers")
          .upsert(payloadChunk, {
            onConflict: "id",
          });

        if (error) {
          throw new Error(
            `인플루언서 일괄 저장 실패: ${error.message}`
          );
        }
      }

      /*
       * 채널도 ID를 미리 지정한 뒤 bulk upsert 합니다.
       * 기존 코드의 채널별 update/insert 반복을 제거했습니다.
       */
      const uniqueChannelMap = new Map<
        string,
        {
          id: string;
          influencer_id: string;
          platform: InfluencerPlatform;
          channel_name: string | null;
          handle: string | null;
          url: string | null;
          followers: number | null;
          avg_views: number | null;
          collaboration_rate: number | null;
          is_primary: boolean;
          memo?: string | null;
        }
      >();

      for (const row of mappedRows) {
        if (!row.platform) continue;

        const influencerId = personIdMap.get(
          personKey(row)
        );
        if (!influencerId) continue;

        const channelLookupKey =
          `${row.platform}::${row.channel_handle.toLowerCase()}`;

        const existingChannel =
          existingChannelMap.get(channelLookupKey);

        const channelId =
          existingChannel?.id ??
          crypto.randomUUID();

        uniqueChannelMap.set(
          `${influencerId}::${row.platform}`,
          {
            id: channelId,
            influencer_id: influencerId,
            platform: row.platform,
            channel_name:
              row.channel_name ??
              row.channel_handle ??
              null,
            handle: row.channel_handle || null,
            url: row.channel_url,
            followers: row.followers,
            avg_views: row.avg_views,
            collaboration_rate:
              existingChannel?.collaboration_rate ??
              null,
            // 먼저 전부 false로 넣고, 아래에서 대표 채널만 묶음 지정합니다.
            is_primary: false,
            memo: existingChannel?.memo ?? null,
          }
        );
      }

      const channelRows = Array.from(
        uniqueChannelMap.values()
      );

      setMessage(
        `3/5 채널 ${channelRows.length.toLocaleString()}개 일괄 저장 중...`
      );

      for (const channelChunk of chunkArray(
        channelRows,
        200
      )) {
        const { error } = await supabase
          .from("influencer_channels")
          .upsert(channelChunk, {
            onConflict: "id",
          });

        if (error) {
          throw new Error(
            `채널 일괄 저장 실패: ${error.message}`
          );
        }
      }

      const influencerIds = Array.from(
        new Set(
          channelRows.map(
            (row) => row.influencer_id
          )
        )
      );

      /*
       * affected influencer의 모든 채널을 묶음 조회해서 대표 채널을 계산합니다.
       */
      const allChannels: any[] = [];

      for (const influencerIdChunk of chunkArray(
        influencerIds,
        200
      )) {
        const { data, error } = await supabase
          .from("influencer_channels")
          .select(
            "id, influencer_id, platform, channel_name, handle, url, followers, avg_views, collaboration_rate, is_primary, memo"
          )
          .in(
            "influencer_id",
            influencerIdChunk
          );

        if (error) {
          throw new Error(
            `전체 채널 재조회 실패: ${error.message}${
              error.details ? ` / ${error.details}` : ""
            }`
          );
        }

        allChannels.push(...(data ?? []));
      }

      const channelsByInfluencer = new Map<
        string,
        any[]
      >();

      for (const channel of allChannels) {
        const rows =
          channelsByInfluencer.get(
            channel.influencer_id
          ) ?? [];
        rows.push(channel);
        channelsByInfluencer.set(
          channel.influencer_id,
          rows
        );
      }

      const primaryChannelIds: string[] = [];

      for (const influencerId of influencerIds) {
        const channels =
          channelsByInfluencer.get(
            influencerId
          ) ?? [];

        if (channels.length === 0) continue;

        const primary = [...channels].sort(
          (a, b) =>
            (Number(b.followers) || 0) -
            (Number(a.followers) || 0)
        )[0];

        if (primary?.id) {
          primaryChannelIds.push(primary.id);
        }
      }

      /*
       * 대표 채널 지정도 사람별 2회 update가 아니라,
       * 200명 단위의 묶음 update로 처리합니다.
       */
      for (const influencerIdChunk of chunkArray(
        influencerIds,
        200
      )) {
        const { error } = await supabase
          .from("influencer_channels")
          .update({ is_primary: false })
          .in(
            "influencer_id",
            influencerIdChunk
          );

        if (error) {
          throw new Error(
            `대표 채널 초기화 실패: ${error.message}`
          );
        }
      }

      for (const primaryIdChunk of chunkArray(
        primaryChannelIds,
        200
      )) {
        const { error } = await supabase
          .from("influencer_channels")
          .update({ is_primary: true })
          .in("id", primaryIdChunk);

        if (error) {
          throw new Error(
            `대표 채널 지정 실패: ${error.message}`
          );
        }
      }

      /*
       * legacy 필드 동기화도 influencer별 update 대신 bulk upsert 합니다.
       */
      const legacySyncRows: Record<
        string,
        any
      >[] = [];

      for (const influencerId of influencerIds) {
        const channels =
          channelsByInfluencer.get(
            influencerId
          ) ?? [];

        if (channels.length === 0) continue;

        const primary = [...channels].sort(
          (a, b) =>
            (Number(b.followers) || 0) -
            (Number(a.followers) || 0)
        )[0];

        const instagram = channels.find(
          (channel) =>
            channel.platform === "instagram"
        );

        const basePayload =
          influencerPayloadMap.get(
            influencerId
          );

        if (!basePayload) continue;

        legacySyncRows.push({
          ...basePayload,
          followers:
            primary?.followers ?? null,
          avg_views:
            primary?.avg_views ?? null,
          collaboration_rate:
            primary?.collaboration_rate ??
            null,
          instagram_id:
            instagram?.handle ??
            basePayload.instagram_id ??
            null,
          instagram_url:
            instagram?.url ??
            basePayload.instagram_url ??
            null,
        });
      }

      for (const syncChunk of chunkArray(
        legacySyncRows,
        200
      )) {
        const { error } = await supabase
          .from("influencers")
          .upsert(syncChunk, {
            onConflict: "id",
          });

        if (error) {
          throw new Error(
            `대표 채널 정보 일괄 동기화 실패: ${error.message}`
          );
        }
      }

      /*
       * 콘텐츠 유형별 협업 단가 저장
       */
      const channelIdByKey = new Map(
        allChannels.map((channel) => [
          `${channel.influencer_id}::${channel.platform}`,
          channel.id,
        ])
      );

      const rateMap = new Map<
        string,
        {
          channel_id: string;
          content_type: string;
          rate: number | null;
        }
      >();

      for (const row of mappedRows) {
        if (!row.platform) continue;

        const influencerId = personIdMap.get(
          personKey(row)
        );

        if (!influencerId) continue;

        const channelId = channelIdByKey.get(
          `${influencerId}::${row.platform}`
        );

        if (!channelId) continue;

        for (const entry of getRateEntries(row)) {
          rateMap.set(
            `${channelId}::${entry.content_type}`,
            {
              channel_id: channelId,
              content_type:
                entry.content_type,
              rate: entry.rate,
            }
          );
        }
      }

      const rateRows = Array.from(
        rateMap.values()
      );

      for (const rateChunk of chunkArray(
        rateRows,
        300
      )) {
        const { error } = await supabase
          .from("influencer_channel_rates")
          .upsert(rateChunk, {
            onConflict:
              "channel_id,content_type",
          });

        if (error) {
          throw new Error(
            `콘텐츠 유형별 단가 저장 실패: ${error.message}`
          );
        }
      }

      setMessage("4/5 캠페인 정보 처리 중...");

      // 캠페인 자동 생성/연결
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

        const key = campaignIdentityKey({
          name: row.campaign_name,
          brand: row.campaign_brand,
          product: row.campaign_product,
        });
        const previous = campaignMetaMap.get(key);

        campaignMetaMap.set(key, {
          name: row.campaign_name.trim(),
          brand:
            row.campaign_brand ??
            previous?.brand ??
            null,
          product:
            row.campaign_product ??
            previous?.product ??
            null,
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
        {
          id: string;
          name: string;
          brand: string | null;
          product: string | null;
        }
      >(
        (existingCampaigns ?? []).map((campaign) => [
          campaignIdentityKey({
            name: campaign.name as string | null,
            brand: campaign.brand as string | null,
            product: campaign.product as string | null,
          }),
          {
            id: campaign.id as string,
            name: campaign.name as string,
            brand: (campaign.brand as string | null) ?? null,
            product: (campaign.product as string | null) ?? null,
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
        const {
          data: createdCampaigns,
          error: campaignInsertError,
        } = await supabase
          .from("campaigns")
          .insert(missingCampaignRows)
          .select("id, name, brand, product");

        if (campaignInsertError) {
          throw new Error(
            `신규 캠페인 생성 실패: ${campaignInsertError.message}`
          );
        }

        createdCampaignIds = (
          createdCampaigns ?? []
        ).map((campaign) => campaign.id as string);

        for (const campaign of createdCampaigns ?? []) {
          campaignMap.set(
            campaignIdentityKey({
              name: campaign.name as string | null,
              brand: campaign.brand as string | null,
              product: campaign.product as string | null,
            }),
            {
              id: campaign.id as string,
              name: campaign.name as string,
              brand: (campaign.brand as string | null) ?? null,
              product: (campaign.product as string | null) ?? null,
            }
          );
        }
      }

      const campaignLinkMap = new Map<
        string,
        {
          campaign_id: string;
          influencer_id: string;
          status: string;
          proposed_rate: number | null;
          final_rate: number | null;
          memo: string | null;
        }
      >();

      for (const row of mappedRows) {
        if (!row.campaign_name) continue;

        const influencerId = personIdMap.get(
          personKey(row)
        );
        const campaign = campaignMap.get(
          campaignIdentityKey({
            name: row.campaign_name,
            brand: row.campaign_brand,
            product: row.campaign_product,
          })
        );

        if (!influencerId || !campaign) continue;

        const key = `${campaign.id}::${influencerId}`;

        const existingLink = campaignLinkMap.get(key);
        const rowMemo = buildCampaignMemo(row);

        campaignLinkMap.set(key, {
          campaign_id: campaign.id,
          influencer_id: influencerId,
          status: "candidate",
          proposed_rate: existingLink?.proposed_rate ?? null,
          final_rate: null,
          memo:
            [existingLink?.memo, rowMemo]
              .filter(Boolean)
              .join("\n") || null,
        });
      }

      const campaignLinks = Array.from(
        campaignLinkMap.values()
      );

      const createdLinkCampaignIdsByInfluencer =
        new Map<string, string[]>();

      if (campaignLinks.length > 0) {
        const campaignIds = Array.from(
          new Set(
            campaignLinks.map(
              (row) => row.campaign_id
            )
          )
        );

        const linkedInfluencerIds = Array.from(
          new Set(
            campaignLinks.map(
              (row) => row.influencer_id
            )
          )
        );

        const existingLinks: Array<{
          campaign_id: string;
          influencer_id: string;
        }> = [];

        /*
         * 캠페인 ID와 인플루언서 ID를 한 번에 큰 .in()으로 보내면
         * GET 요청 URL이 너무 길어져 400 Bad Request가 날 수 있습니다.
         * 양쪽을 모두 작은 묶음으로 나눠 조회합니다.
         */
        for (const campaignIdChunk of chunkArray(campaignIds, 50)) {
          for (const influencerIdChunk of chunkArray(
            linkedInfluencerIds,
            50
          )) {
            const { data, error } = await supabase
              .from("campaign_influencers")
              .select("campaign_id, influencer_id")
              .in("campaign_id", campaignIdChunk)
              .in("influencer_id", influencerIdChunk);

            if (error) {
              throw new Error(
                `캠페인 연결 조회 실패: ${error.message}${
                  error.details ? ` / ${error.details}` : ""
                }`
              );
            }

            existingLinks.push(...(data ?? []));
          }
        }

        const existingLinkKeys = new Set(
          existingLinks.map(
            (row) =>
              `${row.campaign_id}::${row.influencer_id}`
          )
        );

        const newLinks = campaignLinks.filter(
          (row) =>
            !existingLinkKeys.has(
              `${row.campaign_id}::${row.influencer_id}`
            )
        );

        if (newLinks.length > 0) {
          for (const linkChunk of chunkArray(
            newLinks,
            300
          )) {
            const { error: linkInsertError } =
              await supabase
                .from("campaign_influencers")
                .insert(linkChunk);

            if (linkInsertError) {
              throw new Error(
                `캠페인 인플루언서 연결 실패: ${linkInsertError.message}`
              );
            }
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

      const batchItems = Array.from(
        personRowsMap.entries()
      ).map(([key, rows], index) => {
        const influencerId = personIdMap.get(key) ?? null;
        const representative = rows[rows.length - 1];

        return {
          batch_id: batchId,
          influencer_id: influencerId,
          instagram_id:
            rows.find(
              (row) => row.platform === "instagram"
            )?.channel_handle ??
            `${representative.platform}:${representative.channel_handle}`,
          operation:
            influencerId &&
            insertedInfluencerIds.has(influencerId)
              ? "inserted"
              : "updated",
          before_data:
            influencerId
              ? beforeInfluencerMap.get(
                  influencerId
                ) ?? null
              : null,
          imported_data: {
            ...representative,
            channels: rows.map((row) => ({
              platform: row.platform,
              channel_name: row.channel_name,
              handle: row.channel_handle,
              url: row.channel_url,
              followers: row.followers,
              avg_views: row.avg_views,
              content_format: row.content_format,
              content_reference: row.content_reference,
              rates: getRateEntries(row),
            })),
            campaign_history: rows
              .filter((row) => row.campaign_name)
              .map((row) => ({
                campaign_name:
                  row.campaign_name,
                content_format:
                  row.content_format,
                content_reference:
                  row.content_reference,
                rates:
                  getRateEntries(row),
              })),
            __import_meta: {
              created_link_campaign_ids:
                influencerId
                  ? createdLinkCampaignIdsByInfluencer.get(
                      influencerId
                    ) ?? []
                  : [],
              created_campaign_ids:
                index === 0
                  ? createdCampaignIds
                  : [],
            },
          },
        };
      });

      setMessage("5/5 업로드 이력 저장 및 마무리 중...");

      for (const itemChunk of chunkArray(
        batchItems,
        300
      )) {
        const { error: itemError } =
          await supabase
            .from("import_batch_items")
            .insert(itemChunk);

        if (itemError) {
          throw new Error(
            `업로드 내역 저장 실패: ${itemError.message}`
          );
        }
      }

      const insertedCount =
        insertedInfluencerIds.size;
      const updatedCount =
        personRowsMap.size - insertedCount;

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

      const platformCounts = mappedRows.reduce<
        Record<string, number>
      >((acc, row) => {
        const key = row.platform ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

      const platformSummary = Object.entries(
        platformCounts
      )
        .map(([platform, count]) => `${platform} ${count}`)
        .join(", ");

      setMessage(
        `Excel ${mappedRows.length.toLocaleString()}행을 처리해 ${personRowsMap.size.toLocaleString()}명의 인플루언서를 반영했습니다. 채널: ${platformSummary}. 신규 ${insertedCount.toLocaleString()}명, 기존 업데이트 ${updatedCount.toLocaleString()}명, 클린 단가 ${rateRows.length.toLocaleString()}건, 신규 캠페인 ${createdCampaignIds.length.toLocaleString()}개 생성, 캠페인 연결 ${campaignLinks.length.toLocaleString()}건을 확인했습니다.`
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

      /*
       * import_batch_items는 Supabase의 단일 select 반환 제한 때문에
       * 1,000건을 초과하면 일부만 읽힐 수 있습니다.
       * 500건씩 페이지네이션해서 해당 배치의 전체 항목을 가져옵니다.
       */
      const items: BatchItem[] = [];
      const REVERT_PAGE_SIZE = 500;
      let revertFrom = 0;

      while (true) {
        const { data: pageItems, error: itemError } =
          await supabase
            .from("import_batch_items")
            .select("*")
            .eq("batch_id", batch.id)
            .order("created_at", {
              ascending: false,
            })
            .order("id", {
              ascending: false,
            })
            .range(
              revertFrom,
              revertFrom + REVERT_PAGE_SIZE - 1
            );

        if (itemError) {
          throw new Error(
            `업로드 상세 기록 조회 실패: ${itemError.message}`
          );
        }

        if (!pageItems || pageItems.length === 0) {
          break;
        }

        items.push(...(pageItems as BatchItem[]));

        if (pageItems.length < REVERT_PAGE_SIZE) {
          break;
        }

        revertFrom += REVERT_PAGE_SIZE;
      }

      if (items.length === 0) {
        throw new Error(
          "이 업로드에 연결된 상세 기록이 없습니다."
        );
      }

      /*
       * import_batches에 기록된 신규/업데이트 수와 실제 로드된
       * import_batch_items 수가 다르면 불완전한 되돌리기를 막습니다.
       */
      const expectedItemCount =
        (batch.inserted_rows ?? 0) +
        (batch.updated_rows ?? 0);

      if (
        expectedItemCount > 0 &&
        items.length !== expectedItemCount
      ) {
        throw new Error(
          `되돌리기 대상 조회 건수가 일치하지 않습니다. ` +
            `예상 ${expectedItemCount.toLocaleString()}건 / ` +
            `조회 ${items.length.toLocaleString()}건`
        );
      }

      const insertedItems = items.filter(
        (item) => item.operation === "inserted"
      );

      const updatedItems = items.filter(
        (item) => item.operation === "updated"
      );

      const createdCampaignIds = Array.from(
        new Set(
          items.flatMap((item) => {
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

      for (const item of items) {
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
                현재 양식의 광고주/제품/캠페인/채널/아이디/계정명/카테고리/콘텐츠 포맷/URL/레퍼런스/지표/컨택포인트/클린 단가/비고 컬럼을 기준으로 자동 매핑합니다.
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
                    {(field === "platform" ||
                      field === "channel_handle") && (
                      <span className="ml-1 text-slate-400">
                        선택
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

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">
                클린 단가 컬럼 처리 방식
              </p>
              <p className="mt-1">
                한 행에서 여러 단가를 동시에 읽습니다. IG 행은 피드/릴스/스토리,
                YT 행은 BDC/PPL/쇼츠를 저장합니다. 기타 단가는 Blog에서는 Post,
                TikTok에서는 Video, 그 외 플랫폼에서는 Other로 저장합니다.
              </p>
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
                  플랫폼/채널 정보 확인 필요{" "}
                  {invalidCount.toLocaleString()}개
                </span>
              )}
            </div>

            {invalidRows.length > 0 && (
              <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      확인이 필요한 Excel 행
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      아래 행은 업로드 대상에서 제외됩니다. Excel 원본의 행 번호를 확인해
                      채널 / 아이디 / 계정명 / 계정 URL 값을 수정해주세요.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300">
                    {invalidRows.length.toLocaleString()}개
                  </span>
                </div>

                <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-amber-200 bg-white">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead className="sticky top-0 bg-amber-100 text-amber-900">
                      <tr>
                        <th className="px-3 py-2 text-left">Excel 행</th>
                        <th className="px-3 py-2 text-left">사유</th>
                        <th className="px-3 py-2 text-left">채널 원본값</th>
                        <th className="px-3 py-2 text-left">아이디 원본값</th>
                        <th className="px-3 py-2 text-left">계정명 원본값</th>
                        <th className="px-3 py-2 text-left">계정 URL 원본값</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {invalidRows.map((item) => (
                        <tr key={item.excelRow}>
                          <td className="px-3 py-2 font-semibold text-amber-900">
                            {item.excelRow}
                          </td>
                          <td className="px-3 py-2 text-amber-800">
                            {item.reason}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.platformRaw || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.handleRaw || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.channelNameRaw || "-"}
                          </td>
                          <td className="max-w-[320px] break-all px-3 py-2 text-slate-600">
                            {item.urlRaw || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="max-h-[500px] overflow-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">광고주</th>
                    <th className="px-4 py-3 text-left">캠페인</th>
                    <th className="px-4 py-3 text-left">채널</th>
                    <th className="px-4 py-3 text-left">계정명</th>
                    <th className="px-4 py-3 text-left">카테고리</th>
                    <th className="px-4 py-3 text-right">팔로워</th>
                    <th className="px-4 py-3 text-right">평균 조회수</th>
                    <th className="px-4 py-3 text-left">콘텐츠 포맷</th>
                    <th className="px-4 py-3 text-left">클린 단가</th>
                  </tr>
                </thead>

                <tbody>
                  {mappedRows
                    .slice(0, 100)
                    .map((row, index) => (
                      <tr
                        key={`${row.platform}-${row.channel_handle}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3">
                          {row.campaign_brand || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {row.campaign_name || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {row.platform || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {row.channel_name ||
                            (row.channel_handle
                              ? `@${row.channel_handle}`
                              : "-")}
                        </td>
                        <td className="px-4 py-3">
                          {row.category || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.followers?.toLocaleString() || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.avg_views?.toLocaleString() || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {row.content_format || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {getRateEntries(row).length > 0
                            ? getRateEntries(row)
                                .map(
                                  (rate) =>
                                    `${rate.content_type.toUpperCase()} ${formatPriceMan(rate.rate)}`
                                )
                                .join(" · ")
                            : "-"}
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
                플랫폼 열 또는 채널 URL을 기준으로 Instagram, YouTube, TikTok, Naver Blog, Xiaohongshu를 자동 분류합니다. 같은 인물의 여러 채널은 한 인플루언서에 연결하고, 캠페인명이 있으면 기존 캠페인과 연결합니다.
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
