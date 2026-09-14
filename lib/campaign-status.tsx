export const CAMPAIGN_INFLUENCER_STATUS = {
  candidate: "컨택 후보",
  contacting: "컨택 중",
  contacted: "컨택 완료",

  proposal_wait: "기획안 대기",
  draft_wait: "초안 대기",
  final_wait: "최종본 대기",

  completed: "진행 완료",

  declined: "진행 사양",
  stopped: "진행 중단",
} as const;

export function getCampaignInfluencerStatusLabel(
  status: string | null | undefined
) {
  if (!status) return "-";

  return (
    CAMPAIGN_INFLUENCER_STATUS[
      status as keyof typeof CAMPAIGN_INFLUENCER_STATUS
    ] ?? status
  );
}

export function getCampaignInfluencerStatusClass(
  status: string | null | undefined
) {
  switch (status) {
    // 컨택 단계
    case "candidate":
    case "contacting":
    case "contacted":
      return "border-blue-300 bg-blue-50 text-blue-700";

    // 제작 단계
    case "proposal_wait":
    case "draft_wait":
    case "final_wait":
      return "border-amber-300 bg-amber-50 text-amber-700";

    // 정상 완료
    case "completed":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";

    // 사양 / 중단
    case "declined":
    case "stopped":
      return "border-red-300 bg-red-50 text-red-700";

    default:
      return "border-slate-300 bg-slate-100 text-slate-600";
  }
}