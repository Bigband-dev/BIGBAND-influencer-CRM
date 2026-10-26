import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type ExportRate = {
  content_type: string;
  rate: number | null;
};

type ExportChannel = {
  id: string;
  platform: string;
  channel_name: string | null;
  handle: string | null;
  url: string | null;
  followers: number | null;
  avg_views: number | null;
  collaboration_rate: number | null;
  is_primary: boolean | null;
  memo: string | null;
  rates?: ExportRate[] | null;
};

type ExportInfluencer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  categories?: string[] | null;
  memo: string | null;

  // legacy fallback
  instagram_id?: string | null;
  instagram_url?: string | null;
  followers?: number | null;
  avg_views?: number | null;
  collaboration_rate?: number | null;

  channels?: ExportChannel[] | null;
};

const HEADERS = [
  "#",
  "광고주",
  "제품",
  "캠페인",
  "채널",
  "아이디",
  "계정명",
  "카테고리",
  "콘텐츠 포맷",
  "계정 URL",
  "팔로워 수",
  "평균 조회 수",
  "컨택포인트",
  "피드 클린 단가\n(만 원)",
  "릴스 클린 단가 (만 원)",
  "스토리 클린 단가 (만 원)",
  "BDC 클린 단가 (만 원)",
  "PPL 클린 단가 (만 원)",
  "쇼츠 클린 단가 (만 원)",
  "기타 클린 단가 (만 원)",
  "비고",
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "IG",
  ig: "IG",
  youtube: "YT",
  yt: "YT",
  tiktok: "TT",
  tt: "TT",
  naver_blog: "NB",
  naverblog: "NB",
  nb: "NB",
  xiaohongshu: "XHS",
  xhs: "XHS",
};

const CONTENT_LABELS: Record<string, string> = {
  feed: "피드",
  reels: "릴스",
  reel: "릴스",
  story: "스토리",
  bdc: "BDC",
  ppl: "PPL",
  shorts: "쇼츠",
  short: "쇼츠",
  post: "기타",
  video: "기타",
  other: "기타",
};

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

function normalizePlatform(platform: string | null | undefined) {
  const key = (platform ?? "").trim().toLowerCase();
  return PLATFORM_LABELS[key] ?? (platform || "");
}

function normalizeContentType(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getCategories(influencer: ExportInfluencer) {
  if (influencer.categories?.length) {
    return influencer.categories.join(" / ");
  }

  return influencer.category ?? "";
}

function getContactPoint(influencer: ExportInfluencer) {
  const values = [
    influencer.email?.trim(),
    influencer.phone?.trim(),
  ].filter(Boolean);

  return values.join(" / ");
}

function getDefaultContentType(platform: string) {
  const normalized = normalizePlatform(platform);

  if (normalized === "IG") return "reels";
  if (normalized === "YT") return "bdc";
  return "other";
}

function buildRateMap(channel: ExportChannel) {
  const rateMap: Record<string, number | null> = {
    feed: null,
    reels: null,
    story: null,
    bdc: null,
    ppl: null,
    shorts: null,
    other: null,
  };

  for (const rate of channel.rates ?? []) {
    const type = normalizeContentType(rate.content_type);

    if (type === "feed") rateMap.feed = rate.rate;
    else if (type === "reels" || type === "reel") rateMap.reels = rate.rate;
    else if (type === "story") rateMap.story = rate.rate;
    else if (type === "bdc") rateMap.bdc = rate.rate;
    else if (type === "ppl") rateMap.ppl = rate.rate;
    else if (type === "shorts" || type === "short") rateMap.shorts = rate.rate;
    else if (["other", "post", "video"].includes(type)) {
      rateMap.other = rate.rate;
    }
  }

  const hasSpecificRate = Object.values(rateMap).some(
    (value) => value !== null && value !== undefined
  );

  // 과거 collaboration_rate만 남아 있는 데이터도 표준 양식에 보이게 fallback
  if (!hasSpecificRate && channel.collaboration_rate != null) {
    const fallbackType = getDefaultContentType(channel.platform);
    rateMap[fallbackType] = channel.collaboration_rate;
  }

  return rateMap;
}

function getContentFormat(channel: ExportChannel) {
  const activeTypes = (channel.rates ?? [])
    .filter((rate) => rate.rate !== null && rate.rate !== undefined)
    .map((rate) => normalizeContentType(rate.content_type))
    .map((type) => CONTENT_LABELS[type] ?? "기타");

  const unique = [...new Set(activeTypes)];

  if (unique.length > 0) {
    return unique.join(" + ");
  }

  const defaultType = getDefaultContentType(channel.platform);
  return CONTENT_LABELS[defaultType] ?? "기타";
}

function makeLegacyChannel(
  influencer: ExportInfluencer
): ExportChannel | null {
  if (!influencer.instagram_id && !influencer.instagram_url) {
    return null;
  }

  return {
    id: `legacy-${influencer.id}`,
    platform: "instagram",
    channel_name: influencer.name,
    handle: influencer.instagram_id ?? null,
    url: influencer.instagram_url ?? null,
    followers: influencer.followers ?? null,
    avg_views: influencer.avg_views ?? null,
    collaboration_rate: influencer.collaboration_rate ?? null,
    is_primary: true,
    memo: null,
    rates: [],
  };
}

function getFileDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export async function exportSelectedInfluencersToXlsx({
  supabase,
  selectedIds,
}: {
  supabase: SupabaseClient;
  selectedIds: string[];
}) {
  const ids = [...new Set(selectedIds)];

  if (ids.length === 0) {
    throw new Error("다운로드할 인플루언서를 선택해주세요.");
  }

  const influencers: ExportInfluencer[] = [];

  // URL 길이/대량 .in() 문제를 피하기 위해 200개씩 조회
  for (const idChunk of chunk(ids, 200)) {
    const { data, error } = await supabase
      .from("influencers")
      .select(`
        id,
        name,
        email,
        phone,
        category,
        categories,
        memo,
        instagram_id,
        instagram_url,
        followers,
        avg_views,
        collaboration_rate,
        channels:influencer_channels (
          id,
          platform,
          channel_name,
          handle,
          url,
          followers,
          avg_views,
          collaboration_rate,
          is_primary,
          memo,
          rates:influencer_channel_rates (
            content_type,
            rate
          )
        )
      `)
      .in("id", idChunk);

    if (error) {
      throw new Error(`Excel 데이터 조회 실패: ${error.message}`);
    }

    influencers.push(...((data ?? []) as ExportInfluencer[]));
  }

  // 사용자가 체크한 순서에 최대한 맞춤
  const orderMap = new Map(
    ids.map((id, index) => [id, index])
  );

  influencers.sort(
    (a, b) =>
      (orderMap.get(a.id) ?? 0) -
      (orderMap.get(b.id) ?? 0)
  );

  const rows: (string | number | null)[][] = [];
  let rowNumber = 1;

  for (const influencer of influencers) {
    const registeredChannels =
      influencer.channels?.length
        ? [...influencer.channels]
        : [];

    const legacyChannel = makeLegacyChannel(influencer);

    const channels =
      registeredChannels.length > 0
        ? registeredChannels
        : legacyChannel
          ? [legacyChannel]
          : [];

    // 채널이 전혀 없어도 인플루언서 기본정보는 한 행 출력
    const exportChannels: (ExportChannel | null)[] =
      channels.length > 0 ? channels : [null];

    exportChannels.sort((a, b) => {
      if (!a || !b) return 0;
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return 0;
    });

    for (const channel of exportChannels) {
      const rateMap = channel
        ? buildRateMap(channel)
        : {
            feed: null,
            reels: null,
            story: null,
            bdc: null,
            ppl: null,
            shorts: null,
            other: null,
          };

      const memoParts = [
        influencer.memo?.trim(),
        channel?.memo?.trim(),
      ].filter(Boolean);

      rows.push([
        rowNumber,
        "", // 광고주
        "", // 제품
        "", // 캠페인
        channel ? normalizePlatform(channel.platform) : "",
        channel?.handle ?? "",
        channel?.channel_name ?? influencer.name ?? "",
        getCategories(influencer),
        channel ? getContentFormat(channel) : "",
        channel?.url ?? "",
        channel?.followers ?? null,
        channel?.avg_views ?? null,
        getContactPoint(influencer),
        rateMap.feed,
        rateMap.reels,
        rateMap.story,
        rateMap.bdc,
        rateMap.ppl,
        rateMap.shorts,
        rateMap.other,
        memoParts.join("\n"),
      ]);

      rowNumber += 1;
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    ...rows,
  ]);

  worksheet["!cols"] = [
    { wch: 6 },   // #
    { wch: 14 },  // 광고주
    { wch: 14 },  // 제품
    { wch: 20 },  // 캠페인
    { wch: 8 },   // 채널
    { wch: 22 },  // 아이디
    { wch: 22 },  // 계정명
    { wch: 20 },  // 카테고리
    { wch: 18 },  // 콘텐츠 포맷
    { wch: 42 },  // URL
    { wch: 14 },  // 팔로워
    { wch: 14 },  // 평균 조회
    { wch: 32 },  // 컨택포인트
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 45 },  // 비고
  ];

  worksheet["!autofilter"] = {
    ref: `A1:U${rows.length + 1}`,
  };

  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
  };

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "IG 인플루언서"
  );

  const filename =
    `선택_인플루언서_${getFileDate()}.xlsx`;

  XLSX.writeFile(workbook, filename, {
    compression: true,
  });

  return {
    influencerCount: influencers.length,
    rowCount: rows.length,
    filename,
  };
}
