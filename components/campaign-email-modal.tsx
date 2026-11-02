"use client";

import { useMemo, useState } from "react";

export type CampaignEmailRecipient = {
  campaignInfluencerId: string;
  influencerId: string;
  name: string | null;
  email: string | null;
};

type SendResult = {
  success: boolean;
  sender?: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results?: Array<{
    campaignInfluencerId: string;
    influencerId: string;
    name: string | null;
    email: string | null;
    status: "sent" | "failed" | "skipped";
    error?: string | null;
  }>;
};

export default function CampaignEmailModal({
  open,
  campaignId,
  recipients,
  onClose,
  onSent,
}: {
  open: boolean;
  campaignId: string;
  recipients: CampaignEmailRecipient[];
  onClose: () => void;
  onSent?: (result: SendResult) => void;
}) {
  const [subject, setSubject] = useState(
    "[{{brand}}] {{campaign}} 협업 제안의 건"
  );

  const [body, setBody] = useState(
`안녕하세요 {{name}}님,

{{brand}} {{product}} 관련 협업 제안드리고자 연락드립니다.

자세한 내용 확인 후 회신 부탁드립니다.

감사합니다.`
  );

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const mailableCount = useMemo(
    () => recipients.filter((item) => Boolean(item.email?.trim())).length,
    [recipients]
  );

  const missingEmailCount = recipients.length - mailableCount;

  if (!open) {
    return null;
  }

  const handleClose = () => {
    if (sending) return;
    setResult(null);
    onClose();
  };

  const handleSend = async () => {
    if (sending || mailableCount === 0) return;

    if (!subject.trim()) {
      alert("메일 제목을 입력해주세요.");
      return;
    }

    if (!body.trim()) {
      alert("메일 본문을 입력해주세요.");
      return;
    }

    const confirmed = window.confirm(
      `선택한 ${recipients.length}명 중 이메일이 있는 ${mailableCount}명에게 메일을 발송하시겠습니까?`
    );

    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/gmail/send-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId,
          campaignInfluencerIds: recipients.map(
            (item) => item.campaignInfluencerId
          ),
          subject,
          body,
        }),
      });

      const data = (await response.json()) as SendResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "메일 발송 중 오류가 발생했습니다."
        );
      }

      setResult(data);
      onSent?.(data);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "메일 발송 중 오류가 발생했습니다."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              선택 인플루언서에게 메일 보내기
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 로그인 사용자에게 연결된 Gmail 계정으로 발송합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={sending}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            닫기
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">
                선택
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {recipients.length}명
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">
                발송 가능
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">
                {mailableCount}명
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-700">
                이메일 없음
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-800">
                {missingEmailCount}명
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">
                수신자
              </p>
            </div>

            <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
              {recipients.map((recipient) => (
                <div
                  key={recipient.campaignInfluencerId}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-800">
                    {recipient.name || "이름 없음"}
                  </span>

                  <span
                    className={
                      recipient.email
                        ? "text-slate-600"
                        : "font-medium text-amber-700"
                    }
                  >
                    {recipient.email || "이메일 없음"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              제목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={sending}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              본문
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={sending}
              rows={12}
              className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-500 disabled:bg-slate-100"
            />
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            사용할 수 있는 변수:
            <strong className="ml-1 text-slate-700">
              {"{{name}}"}, {"{{campaign}}"}, {"{{brand}}"}, {"{{product}}"}
            </strong>
            <br />
            각 수신자에게 발송할 때 실제 이름과 캠페인 정보로 자동 치환됩니다.
          </div>

          {result && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-900">
                발송 처리 완료
              </p>
              <p className="mt-2 text-sm text-blue-800">
                발송 {result.sent}명 · 실패 {result.failed}명 ·
                이메일 없음 {result.skipped}명
              </p>
              {result.sender && (
                <p className="mt-1 text-xs text-blue-700">
                  발송 계정: {result.sender}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={sending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {result ? "확인" : "취소"}
          </button>

          {!result && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || mailableCount === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending
                ? "메일 발송 중..."
                : `${mailableCount}명에게 발송`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
