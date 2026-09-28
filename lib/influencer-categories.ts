export const INFLUENCER_CATEGORIES = [
  "뷰티",
  "패션",
  "다이어트/자기관리",
  "푸드/요리",
  "리빙/인테리어",
  "육아/가족",
  "건강/운동",
  "여행",
  "직장/커리어",
  "재테크/금융",
  "IT/테크",
  "교육/지식",
  "문화/예술",
  "게임",
  "스포츠/레저",
  "반려동물",
  "환경/가치소비",
  "라이프스타일/일상",
  "취미/공예",
  "엔터테인먼트",
] as const;

export type InfluencerCategory =
  (typeof INFLUENCER_CATEGORIES)[number];