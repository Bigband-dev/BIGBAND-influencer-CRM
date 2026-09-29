type BuildGmailComposeUrlParams = {
  email: string;
  influencerName?: string | null;
  userName?: string | null;
};

function formatTodayKST() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}

export function buildGmailComposeUrl({
  email,
}: BuildGmailComposeUrlParams) {
  const subject =
    `[빅밴드] 브랜드명 유가광고 제안의 건_${formatTodayKST()}`;

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: subject,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}