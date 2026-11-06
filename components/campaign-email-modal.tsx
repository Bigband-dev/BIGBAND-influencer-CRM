"use client";

import { useEffect, useMemo, useState } from "react";

export type CampaignEmailRecipient = {
  campaignInfluencerId: string;
  influencerId: string;
  name: string | null;
  email: string | null;
};

type DraftPreset = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

const DRAFT_PRESETS: DraftPreset[] = [
  {
    id: "collaboration",
    label: "협업 제안",
    subject: "[{{브랜드}}] {{제품}} 협업 제안",
    body: `안녕하세요 {{인플루언서명}}님,

{{브랜드}} {{제품}} 관련 협업 제안드리고자 연락드립니다.

협업 가능 여부와 일정 확인 후 회신 부탁드립니다.

감사합니다.`,
  },
  {
    id: "detail",
    label: "협업 상세 안내",
    subject: "[{{브랜드}}] {{제품}} 협업 상세 안내",
    body: `안녕하세요 {{인플루언서명}}님,

{{브랜드}} {{제품}} 협업 관련 상세 내용 전달드립니다.

내용 확인 후 편하게 회신 부탁드립니다.

감사합니다.`,
  },
  {
    id: "blank",
    label: "빈 초안",
    subject: "",
    body: "",
  },
];

type SendResult = {
  success: boolean;
  sender?: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
};

type PreviewResult = {
  success: boolean;
  sender: string;
  recipientName: string | null;
  recipientEmail: string | null;
  subject: string;
  body: string;
  html: string;
  hasSignature: boolean;
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
  const [presetId, setPresetId] = useState("collaboration");
  const [subject, setSubject] = useState(DRAFT_PRESETS[0].subject);
  const [body, setBody] = useState(DRAFT_PRESETS[0].body);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const mailableCount = useMemo(
    () => recipients.filter((item) => Boolean(item.email?.trim())).length,
    [recipients]
  );

  const missingEmailCount = recipients.length - mailableCount;

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setPreview(null);
    setActiveTab("write");
  }, [open]);

  if (!open) return null;

  const applyPreset = (nextPresetId: string) => {
    const preset = DRAFT_PRESETS.find((item) => item.id === nextPresetId);
    if (!preset) return;

    const hasCurrentDraft = subject.trim() || body.trim();

    if (
      hasCurrentDraft &&
      !window.confirm(
        "초안을 변경하면 현재 작성한 제목과 본문이 바뀝니다. 계속할까요?"
      )
    ) {
      return;
    }

    setPresetId(nextPresetId);
    setSubject(preset.subject);
    setBody(preset.body);
    setPreview(null);
    setActiveTab("write");
  };

  const handleClose = () => {
    if (sending || previewing) return;
    setResult(null);
    setPreview(null);
    onClose();
  };

  const requestApi = async (mode: "preview" | "send") => {
    const response = await fetch("/api/gmail/send-bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        campaignId,
        campaignInfluencerIds: recipients.map(
          (item) => item.campaignInfluencerId
        ),
        subject,
        body,
      }),
    });

    const responseText = await response.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `메일 API가 JSON이 아닌 응답을 반환했습니다. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      if (
        data.code === "GMAIL_NOT_CONNECTED" ||
        String(data.error ?? "").includes("Gmail 계정이 연결되어 있지 않습니다") ||
        String(data.error ?? "").includes("연결된 Gmail 계정이 없습니다")
      ) {
        alert(
          "Gmail 계정 연결이 필요합니다.\n확인을 누르면 Gmail 연결 화면으로 이동합니다."
        );
        const returnTo =
          window.location.pathname + window.location.search;

        window.location.href =
          `/api/google/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;

        const gmailError = new Error("GMAIL_REDIRECTING");
        (gmailError as Error & { code?: string }).code =
          "GMAIL_REDIRECTING";
        throw gmailError;
      }

      throw new Error(
        data.error || "메일 처리 중 오류가 발생했습니다."
      );
    }

    return data;
  };

  const requestPreview = async () => {
    if (!subject.trim()) {
      alert("메일 제목을 입력해주세요.");
      return;
    }

    if (!body.trim()) {
      alert("메일 본문을 입력해주세요.");
      return;
    }

    setPreviewing(true);

    try {
      const data = (await requestApi("preview")) as PreviewResult;
      setPreview(data);
      setActiveTab("preview");
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;

      if (code !== "GMAIL_REDIRECTING") {
        alert(
          error instanceof Error
            ? error.message
            : "메일 미리보기를 불러오지 못했습니다."
        );
      }
    } finally {
      setPreviewing(false);
    }
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
      const data = (await requestApi("send")) as SendResult;
      setResult(data);
      onSent?.(data);
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;

      if (code !== "GMAIL_REDIRECTING") {
        alert(
          error instanceof Error
            ? error.message
            : "메일 발송 중 오류가 발생했습니다."
        );
      }
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
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              선택 인플루언서에게 메일 보내기
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              초안을 선택한 뒤 제목과 본문을 자유롭게 수정할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={sending || previewing}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            닫기
          </button>
        </div>

        <div className="border-b border-slate-200 px-6 pt-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("write")}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                activeTab === "write"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500"
              }`}
            >
              작성
            </button>

            <button
              type="button"
              onClick={requestPreview}
              disabled={previewing}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                activeTab === "preview"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500"
              } disabled:opacity-40`}
            >
              {previewing ? "미리보기 생성 중..." : "미리보기"}
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">선택</p>
              <p className="mt-1 text-2xl font-bold">{recipients.length}명</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium text-emerald-700">발송 가능</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">
                {mailableCount}명
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-700">이메일 없음</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">
                {missingEmailCount}명
              </p>
            </div>
          </div>

          {activeTab === "write" ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  초안 선택
                </label>

                <select
                  value={presetId}
                  onChange={(event) => applyPreset(event.target.value)}
                  disabled={sending}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm"
                >
                  {DRAFT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  제목
                </label>

                <input
                  type="text"
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    setPreview(null);
                  }}
                  placeholder="예: [삼성전자] 갤럭시워치 협업 제안"
                  disabled={sending}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
                />

                <p className="mt-2 text-xs text-slate-500">
                  캠페인명은 제목에 자동으로 강제하지 않습니다. 최종 제목을 직접 확인하고 수정한 뒤 발송하세요.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  본문
                </label>

                <textarea
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setPreview(null);
                  }}
                  disabled={sending}
                  rows={13}
                  className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-500 disabled:bg-slate-100"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">
                  각 정보가 의미하는 내용
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold text-slate-700">
                      {"{{인플루언서명}}"}
                    </span>
                    <span className="ml-2">
                      선택한 인플루언서의 이름
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700">
                      {"{{브랜드}}"}
                    </span>
                    <span className="ml-2">
                      현재 캠페인에 등록된 브랜드명
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700">
                      {"{{제품}}"}
                    </span>
                    <span className="ml-2">
                      현재 캠페인에 등록된 제품명
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-700">
                      {"{{캠페인명}}"}
                    </span>
                    <span className="ml-2">
                      현재 캠페인에 등록된 캠페인명
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                                <p className="font-semibold text-slate-700">
                  사용 가능한 정보
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                    {"{{인플루언서명}}"}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                    {"{{브랜드}}"}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                    {"{{제품}}"}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1">
                    {"{{캠페인명}}"}
                  </span>
                </div>
                <p className="mt-2">
                  미리보기와 실제 발송 시 각 인플루언서와 캠페인 정보가 자동으로 입력되어 전송됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={requestPreview}
                disabled={previewing}
                className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
              >
                {previewing ? "미리보기 생성 중..." : "실제 메일 형태 미리보기"}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {!preview ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
                  미리보기를 생성해주세요.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold">보내는 사람:</span>{" "}
                        {preview.sender}
                      </p>
                      <p>
                        <span className="font-semibold">미리보기 수신자:</span>{" "}
                        {preview.recipientName || "-"}{" "}
                        {preview.recipientEmail
                          ? `(${preview.recipientEmail})`
                          : ""}
                      </p>
                    </div>

                    <p className="mt-3">
                      <span className="font-semibold">제목:</span>{" "}
                      {preview.subject}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Gmail 개인 서명: {preview.hasSignature ? "포함됨" : "설정된 서명 없음"}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-300 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      실제 메일 본문 미리보기
                    </div>
                    <iframe
                      title="메일 미리보기"
                      srcDoc={preview.html}
                      sandbox=""
                      className="h-[420px] w-full bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    다시 수정
                  </button>
                </>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-900">발송 처리 완료</p>
              <p className="mt-2 text-sm text-blue-800">
                발송 {result.sent}명 · 실패 {result.failed}명 · 이메일 없음 {result.skipped}명
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
            disabled={sending || previewing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {result ? "확인" : "취소"}
          </button>

          {!result && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || previewing || mailableCount === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "메일 발송 중..." : `${mailableCount}명에게 발송`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
