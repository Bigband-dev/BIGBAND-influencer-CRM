"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

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

type PreviewItem = {
  recipientName: string | null;
  recipientEmail: string | null;
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  html: string;
};

type PreviewResult = {
  success: boolean;
  sender: string;
  previews: PreviewItem[];
  hasSignature: boolean;
  individualizeBcc?: boolean;
};

type GoogleContactSuggestion = {
  name: string | null;
  email: string;
  source: "directory" | "contact";
};

type RecipientChip = {
  name: string | null;
  email: string;
  source?: "directory" | "contact" | "influencer" | "manual";
  campaignInfluencerId?: string;
  influencerId?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function addRecipient(
  current: RecipientChip[],
  recipient: RecipientChip
) {
  const email = recipient.email.trim();
  if (!email) return current;

  const exists = current.some(
    (item) =>
      normalizeEmail(item.email) === normalizeEmail(email)
  );

  if (exists) return current;

  return [
    ...current,
    {
      ...recipient,
      email,
    },
  ];
}

function addRecipients(
  current: RecipientChip[],
  recipients: RecipientChip[]
) {
  return recipients.reduce(
    (result, recipient) => addRecipient(result, recipient),
    current
  );
}

function RecipientChipField({
  label,
  description,
  recipients,
  setRecipients,
  disabled,
  selectedInfluencers,
  onNeedsReconnect,
  influencerButtonLabel = "선택 인플루언서 추가",
  warnOnInfluencerAdd = true,
}: {
  label: string;
  description: string;
  recipients: RecipientChip[];
  setRecipients: Dispatch<SetStateAction<RecipientChip[]>>;
  disabled: boolean;
  selectedInfluencers: RecipientChip[];
  onNeedsReconnect: () => void;
  influencerButtonLabel?: string;
  warnOnInfluencerAdd?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    GoogleContactSuggestion[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 1) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(
          `/api/google/contacts/search?q=${encodeURIComponent(trimmed)}`
        );

        const data = await response.json();

        if (
          response.status === 409 &&
          data.code === "GMAIL_NOT_CONNECTED"
        ) {
          onNeedsReconnect();
          setSuggestions([]);
          return;
        }

        if (!response.ok) {
          setSuggestions([]);
          setSearchError(
            data.error || `주소록 검색에 실패했습니다. HTTP ${response.status}`
          );
          return;
        }

        if (data.needsReconnect) {
          onNeedsReconnect();
        }

        const nextSuggestions = data.contacts ?? [];
        setSuggestions(nextSuggestions);

        if (nextSuggestions.length === 0) {
          const details = [
            data.directoryError
              ? `회사 주소록: ${data.directoryError}`
              : "",
            data.contactsError
              ? `개인 연락처: ${data.contactsError}`
              : "",
          ]
            .filter(Boolean)
            .join(" / ");

          setSearchError(
            details ||
              "일치하는 이름 또는 이메일을 찾지 못했습니다."
          );
        } else {
          setSearchError(null);
        }
      } catch (error) {
        setSuggestions([]);
        setSearchError(
          error instanceof Error
            ? error.message
            : "주소록 검색 중 오류가 발생했습니다."
        );
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, onNeedsReconnect]);

  const addManualEmail = () => {
    const email = query.trim();

    if (!email) return;

    if (!isValidEmail(email)) {
      alert("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    setRecipients((current) =>
      addRecipient(current, {
        name: null,
        email,
        source: "manual",
      })
    );

    setQuery("");
    setSuggestions([]);
    setSearchError(null);
  };

  const addAllInfluencers = () => {
    if (selectedInfluencers.length === 0) {
      alert(
        "현재 선택한 인플루언서 중 이메일이 등록된 사람이 없습니다."
      );
      return;
    }

    if (warnOnInfluencerAdd) {
      const confirmed = window.confirm(
        `선택한 인플루언서 ${selectedInfluencers.length}명을 ${label}에 추가할까요?\n\n` +
          "현재 메일은 받는 사람(To) 각각에게 개별 발송되므로, 같은 인플루언서를 CC/BCC에도 넣으면 중복 수신될 수 있습니다."
      );

      if (!confirmed) return;
    }

    setRecipients((current) =>
      addRecipients(current, selectedInfluencers)
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-sm font-semibold text-slate-700">
            {label}
          </label>
          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={addAllInfluencers}
          disabled={
            disabled || selectedInfluencers.length === 0
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
        >
          {influencerButtonLabel} ({selectedInfluencers.length}명)
        </button>
      </div>

      <div className="relative">
        <div
          className={`flex min-h-[48px] flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2 ${
            disabled
              ? "border-slate-200 bg-slate-100"
              : "border-slate-300 focus-within:border-slate-500"
          }`}
        >
          {recipients.map((recipient) => (
            <span
              key={recipient.email.toLowerCase()}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-800"
              title={
                recipient.name
                  ? `${recipient.name} <${recipient.email}>`
                  : recipient.email
              }
            >
              <span className="max-w-[260px] truncate">
                {recipient.name || recipient.email}
              </span>

              {recipient.name && (
                <span className="hidden max-w-[220px] truncate text-xs text-slate-500 sm:inline">
                  {recipient.email}
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  setRecipients((current) =>
                    current.filter(
                      (item) =>
                        normalizeEmail(item.email) !==
                        normalizeEmail(recipient.email)
                    )
                  )
                }
                disabled={disabled}
                className="rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
                aria-label={`${recipient.email} 제거`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === "," ||
                event.key === ";"
              ) {
                if (query.trim().includes("@")) {
                  event.preventDefault();
                  addManualEmail();
                }
              }

              if (
                event.key === "Backspace" &&
                !query &&
                recipients.length > 0
              ) {
                setRecipients((current) =>
                  current.slice(0, -1)
                );
              }
            }}
            placeholder={
              recipients.length === 0
                ? "이름 또는 이메일 검색"
                : ""
            }
            disabled={disabled}
            className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />

          {searching && (
            <span className="text-xs text-slate-400">
              검색 중...
            </span>
          )}
        </div>

        {query.trim() && searchError && suggestions.length === 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {searchError}
          </div>
        )}

        {query.trim() && suggestions.length > 0 && (
          <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            {suggestions.map((contact) => (
              <button
                key={`${contact.source}-${contact.email}`}
                type="button"
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => {
                  setRecipients((current) =>
                    addRecipient(current, {
                      name: contact.name,
                      email: contact.email,
                      source: contact.source,
                    })
                  );
                  setQuery("");
                  setSuggestions([]);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {contact.name || contact.email}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        contact.source === "directory"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {contact.source === "directory"
                        ? "회사"
                        : "연락처"}
                    </span>
                  </span>

                  {contact.name && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {contact.email}
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-xs text-slate-400">
                  추가
                </span>
              </button>
            ))}
          </div>
        )}

        {query.trim().includes("@") &&
          isValidEmail(query.trim()) &&
          !suggestions.some(
            (item) =>
              normalizeEmail(item.email) ===
              normalizeEmail(query)
          ) && (
            <button
              type="button"
              onClick={addManualEmail}
              className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-lg hover:bg-slate-50"
            >
              <span className="font-semibold">
                {query.trim()}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                직접 추가
              </span>
            </button>
          )}
      </div>
    </div>
  );
}

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
  const [toRecipients, setToRecipients] = useState<RecipientChip[]>([]);
  const [ccRecipients, setCcRecipients] = useState<RecipientChip[]>([]);
  const [bccRecipients, setBccRecipients] = useState<RecipientChip[]>([]);
  const [individualizeBcc, setIndividualizeBcc] = useState(false);
  const [showCopyFields, setShowCopyFields] = useState(true);
  const [contactsNeedReconnect, setContactsNeedReconnect] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [reviewedPreviewEmails, setReviewedPreviewEmails] = useState<Set<string>>(
    () => new Set()
  );
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const selectedMailableCount = useMemo(
    () => recipients.filter((item) => Boolean(item.email?.trim())).length,
    [recipients]
  );

  const individualizedRecipients = useMemo(
    () =>
      individualizeBcc
        ? addRecipients(toRecipients, bccRecipients)
        : toRecipients,
    [toRecipients, bccRecipients, individualizeBcc]
  );

  const mailableCount = individualizedRecipients.length;
  const missingEmailCount = recipients.length - selectedMailableCount;

  const previewItems = preview?.previews ?? [];
  const currentPreview = previewItems[previewIndex] ?? null;
  const allPreviewsReviewed =
    previewItems.length > 0 &&
    reviewedPreviewEmails.size >= previewItems.length;

  const selectedInfluencerRecipients = useMemo(
    () =>
      recipients
        .filter((item) => Boolean(item.email?.trim()))
        .map((item) => ({
          name: item.name,
          email: item.email!.trim(),
          source: "influencer" as const,
          campaignInfluencerId: item.campaignInfluencerId,
          influencerId: item.influencerId,
        }))
        .filter(
          (item, index, items) =>
            items.findIndex(
              (candidate) =>
                normalizeEmail(candidate.email) ===
                normalizeEmail(item.email)
            ) === index
        ),
    [recipients]
  );

  useEffect(() => {
    if (!open) return;
    setToRecipients(selectedInfluencerRecipients);
    setIndividualizeBcc(false);
    setResult(null);
    setPreview(null);
    setPreviewIndex(0);
    setReviewedPreviewEmails(new Set());
    setActiveTab("write");
  }, [open, selectedInfluencerRecipients]);

  useEffect(() => {
    if (!open) return;

    fetch("/api/google/contacts/search?warmup=1").catch(
      () => undefined
    );
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
    setPreviewIndex(0);
    setReviewedPreviewEmails(new Set());
    setActiveTab("write");
  };

  const handleClose = () => {
    if (sending || previewing) return;
    setResult(null);
    setPreview(null);
    setPreviewIndex(0);
    setReviewedPreviewEmails(new Set());
    onClose();
  };

  const reconnectGoogleContacts = () => {
    const returnTo =
      window.location.pathname + window.location.search;

    window.location.href =
      `/api/google/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
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
        campaignInfluencerIds: individualizedRecipients
          .map((item) => item.campaignInfluencerId)
          .filter((value): value is string => Boolean(value)),
        toRecipients: toRecipients.map((item) => ({
          name: item.name,
          email: item.email,
          campaignInfluencerId: item.campaignInfluencerId ?? null,
          influencerId: item.influencerId ?? null,
        })),
        bccRecipients: bccRecipients.map((item) => ({
          name: item.name,
          email: item.email,
          campaignInfluencerId: item.campaignInfluencerId ?? null,
          influencerId: item.influencerId ?? null,
        })),
        individualizeBcc,
        subject,
        body,
        cc: ccRecipients.map((item) => item.email),
        bcc: bccRecipients.map((item) => item.email),
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
    if (individualizedRecipients.length === 0) {
      alert("받는 사람 또는 숨은참조 수신자를 한 명 이상 추가해주세요.");
      return;
    }

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

      if (!data.previews?.length) {
        throw new Error("생성된 메일 미리보기가 없습니다.");
      }

      setPreview(data);
      setPreviewIndex(0);

      const firstEmail = data.previews[0]?.recipientEmail;

      setReviewedPreviewEmails(
        new Set(
          firstEmail
            ? [normalizeEmail(firstEmail)]
            : []
        )
      );

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

  const openPreviewAt = (nextIndex: number) => {
    if (!previewItems.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(nextIndex, previewItems.length - 1)
    );

    setPreviewIndex(safeIndex);

    const email = previewItems[safeIndex]?.recipientEmail;
    if (email) {
      setReviewedPreviewEmails((current) => {
        const next = new Set(current);
        next.add(normalizeEmail(email));
        return next;
      });
    }
  };

  const handleSend = async () => {
    if (sending || mailableCount === 0) return;

    if (individualizedRecipients.length === 0) {
      alert("받는 사람 또는 숨은참조 수신자를 한 명 이상 추가해주세요.");
      return;
    }

    if (!previewItems.length) {
      alert("먼저 메일 미리보기를 생성해주세요.");
      setActiveTab("preview");
      return;
    }

    if (!allPreviewsReviewed) {
      alert(
        `전체 미리보기를 확인해주세요. (${reviewedPreviewEmails.size}/${previewItems.length})`
      );
      setActiveTab("preview");
      return;
    }

    if (!subject.trim()) {
      alert("메일 제목을 입력해주세요.");
      return;
    }

    if (!body.trim()) {
      alert("메일 본문을 입력해주세요.");
      return;
    }

    const confirmed = window.confirm(
      individualizeBcc
        ? `받는 사람 + 숨은참조 총 ${individualizedRecipients.length}명에게 각각 개인화된 메일을 발송하시겠습니까?\n\n참조(CC)는 각 메일에 공통으로 포함됩니다.`
        : `받는 사람 ${toRecipients.length}명에게 각각 개별 메일을 발송하시겠습니까?`
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

              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <RecipientChipField
                  label="받는 사람"
                  description="현재 선택한 인플루언서가 기본으로 들어갑니다. 팀원/외부 이메일을 검색하거나 직접 입력할 수 있으며, 각 주소로 개별 메일이 발송됩니다."
                  recipients={toRecipients}
                  setRecipients={(next) => {
                    setToRecipients(next);
                    setPreview(null);
                    setPreviewIndex(0);
                    setReviewedPreviewEmails(new Set());
                  }}
                  disabled={sending}
                  selectedInfluencers={selectedInfluencerRecipients}
                  onNeedsReconnect={() =>
                    setContactsNeedReconnect(true)
                  }
                  influencerButtonLabel="선택 인플루언서 다시 추가"
                  warnOnInfluencerAdd={false}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      참조 / 숨은참조
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      이름/이메일을 검색하면 회사 Google Workspace 디렉터리와 개인 연락처에서 후보가 표시됩니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCopyFields((value) => !value)}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {showCopyFields ? "접기" : "참조/숨은참조 열기"}
                  </button>
                </div>

                {contactsNeedReconnect && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Google 회사 주소록/연락처 권한이 필요합니다.
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        직접 입력은 그대로 사용할 수 있고, 회사 디렉터리 및 연락처 자동완성을 사용하려면 Gmail을 한 번 다시 연결해주세요.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={reconnectGoogleContacts}
                      className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Gmail 다시 연결
                    </button>
                  </div>
                )}

                {showCopyFields && (
                  <div className="mt-4 grid gap-5">
                    <RecipientChipField
                      label="참조"
                      description="회사 디렉터리나 개인 Google 연락처를 검색하거나 이메일을 직접 입력할 수 있습니다."
                      recipients={ccRecipients}
                      setRecipients={(next) => {
                        setCcRecipients(next);
                        setPreview(null);
                        setPreviewIndex(0);
                        setReviewedPreviewEmails(new Set());
                      }}
                      disabled={sending}
                      selectedInfluencers={selectedInfluencerRecipients}
                      onNeedsReconnect={() =>
                        setContactsNeedReconnect(true)
                      }
                    />

                    <RecipientChipField
                      label="숨은참조"
                      description="추가된 주소는 다른 수신자에게 표시되지 않습니다."
                      recipients={bccRecipients}
                      setRecipients={(next) => {
                        setBccRecipients(next);
                        setPreview(null);
                        setPreviewIndex(0);
                        setReviewedPreviewEmails(new Set());
                      }}
                      disabled={sending}
                      selectedInfluencers={selectedInfluencerRecipients}
                      onNeedsReconnect={() =>
                        setContactsNeedReconnect(true)
                      }
                    />

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            숨은참조 개별 발송
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            받는 사람과 숨은참조를 모두 개별 발송합니다.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIndividualizeBcc((current) => !current);
                            setPreview(null);
                            setPreviewIndex(0);
                            setReviewedPreviewEmails(new Set());
                          }}
                          disabled={sending}
                          className={
                            individualizeBcc
                              ? "shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                              : "shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          }
                        >
                          {individualizeBcc ? "켜짐" : "꺼짐"}
                        </button>
                      </div>

                      {individualizeBcc && (
                        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                          현재 개별 발송 대상: {individualizedRecipients.length}명
                          · To {toRecipients.length}명
                          · BCC {bccRecipients.length}명
                          <br />
                          같은 이메일이 To와 BCC에 모두 있으면 한 번만 발송됩니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
              {!preview || !currentPreview ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  미리보기를 생성하면 각 수신자에게 실제로 발송될 메일을
                  한 명씩 확인할 수 있습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        수신자별 미리보기
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {previewIndex + 1} / {previewItems.length}
                        {" · "}
                        확인 완료 {reviewedPreviewEmails.size} / {previewItems.length}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPreviewAt(previewIndex - 1)}
                        disabled={previewIndex === 0}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ← 이전
                      </button>

                      <button
                        type="button"
                        onClick={() => openPreviewAt(previewIndex + 1)}
                        disabled={previewIndex >= previewItems.length - 1}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        다음 →
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="grid gap-1.5 text-xs text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-700">
                            보내는 사람:
                          </span>{" "}
                          {preview.sender}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-700">
                            받는 사람:
                          </span>{" "}
                          {currentPreview.recipientName || "-"}{" "}
                          {currentPreview.recipientEmail
                            ? `(${currentPreview.recipientEmail})`
                            : ""}
                        </p>

                        {currentPreview.cc?.length > 0 && (
                          <p>
                            <span className="font-semibold text-slate-700">
                              참조:
                            </span>{" "}
                            {currentPreview.cc.join(", ")}
                          </p>
                        )}

                        {currentPreview.bcc?.length > 0 && (
                          <p>
                            <span className="font-semibold text-slate-700">
                              숨은참조:
                            </span>{" "}
                            {currentPreview.bcc.join(", ")}
                          </p>
                        )}

                        <p className="pt-1 text-sm font-semibold text-slate-900">
                          {currentPreview.subject}
                        </p>

                        <p className="text-[11px] text-slate-400">
                          Gmail 개인 서명:{" "}
                          {preview.hasSignature ? "포함됨" : "설정된 서명 없음"}
                        </p>
                      </div>
                    </div>

                    <iframe
                      title={`메일 미리보기 ${previewIndex + 1}`}
                      srcDoc={currentPreview.html}
                      sandbox=""
                      className="h-[440px] w-full bg-white"
                    />
                  </div>

                  <div
                    className={
                      allPreviewsReviewed
                        ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                        : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                    }
                  >
                    {allPreviewsReviewed
                      ? `전체 ${previewItems.length}명의 메일 미리보기를 확인했습니다. 이제 발송할 수 있습니다.`
                      : `아직 ${previewItems.length - reviewedPreviewEmails.size}명의 미리보기를 확인해야 합니다. 이전/다음 버튼으로 전부 확인해주세요.`}
                  </div>
                </div>
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
              disabled={
                sending ||
                previewing ||
                mailableCount === 0 ||
                !allPreviewsReviewed
              }
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
