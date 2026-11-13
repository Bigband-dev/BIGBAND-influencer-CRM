"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

type RecipientSource =
  | "directory"
  | "contact"
  | "manual";

type RecipientChip = {
  name: string | null;
  email: string;
  source?: RecipientSource;
};

type SearchResult = RecipientChip;

type PreviewItem = {
  recipientName: string | null;
  recipientEmail: string;
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
};

type SendResult = {
  success: boolean;
  sender?: string;
  total: number;
  sent: number;
  failed: number;
  results?: Array<{
    name: string | null;
    email: string;
    status: "sent" | "failed";
    error?: string | null;
  }>;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim()
  );
}

function addRecipients(
  current: RecipientChip[],
  additions: RecipientChip[]
) {
  const seen = new Set(
    current.map((item) => normalizeEmail(item.email))
  );

  const next = [...current];

  for (const item of additions) {
    const email = item.email.trim();
    const key = normalizeEmail(email);

    if (!email || seen.has(key)) continue;

    seen.add(key);
    next.push({
      ...item,
      email,
    });
  }

  return next;
}

function sourceLabel(
  source?: RecipientSource
) {
  if (source === "directory") return "회사";
  if (source === "contact") return "연락처";
  return "직접 입력";
}

function RecipientField({
  label,
  description,
  recipients,
  setRecipients,
  disabled,
  onChanged,
}: {
  label: string;
  description: string;
  recipients: RecipientChip[];
  setRecipients: (
    next: RecipientChip[]
  ) => void;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] =
    useState<SearchResult[]>([]);
  const [searching, setSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setSuggestions([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller =
      new AbortController();

    const timer = window.setTimeout(
      async () => {
        setSearching(true);
        setSearchError(null);

        try {
          const response = await fetch(
            `/api/google/contacts/search?q=${encodeURIComponent(
              trimmed
            )}`,
            {
              signal: controller.signal,
            }
          );

          const data =
            await response.json();

          if (!response.ok) {
            setSuggestions([]);
            setSearchError(
              data.error ||
                "주소록 검색에 실패했습니다."
            );
            return;
          }

          setSuggestions(
            data.contacts ?? []
          );

          if (
            !data.contacts?.length
          ) {
            setSearchError(
              "일치하는 이름 또는 이메일을 찾지 못했습니다."
            );
          }
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            return;
          }

          setSuggestions([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "주소록 검색 중 오류가 발생했습니다."
          );
        } finally {
          setSearching(false);
        }
      },
      250
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const addOne = (
    item: RecipientChip
  ) => {
    setRecipients(
      addRecipients(recipients, [item])
    );
    setQuery("");
    setSuggestions([]);
    setSearchError(null);
    onChanged();
  };

  const addManual = () => {
    const email = query.trim();

    if (!isValidEmail(email)) {
      return false;
    }

    addOne({
      name: null,
      email,
      source: "manual",
    });

    return true;
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      event.key === "Enter" ||
      event.key === "," ||
      event.key === ";"
    ) {
      event.preventDefault();
      addManual();
      return;
    }

    if (
      event.key === "Backspace" &&
      !query &&
      recipients.length > 0
    ) {
      setRecipients(
        recipients.slice(0, -1)
      );
      onChanged();
    }
  };

  const remove = (email: string) => {
    setRecipients(
      recipients.filter(
        (item) =>
          normalizeEmail(item.email) !==
          normalizeEmail(email)
      )
    );
    onChanged();
  };

  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-semibold text-slate-800">
          {label}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <div className="relative">
        <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-500">
          {recipients.map((item) => (
            <span
              key={normalizeEmail(
                item.email
              )}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700"
            >
              <span className="font-medium">
                {item.name ||
                  item.email}
              </span>

              {item.name && (
                <span className="text-slate-400">
                  {item.email}
                </span>
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  remove(item.email)
                }
                className="ml-1 text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </span>
          ))}

          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder={
              recipients.length
                ? "추가 수신자 검색..."
                : "이름 또는 이메일 검색..."
            }
            className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
          />
        </div>

        {searching && (
          <p className="mt-2 text-xs text-slate-400">
            검색 중...
          </p>
        )}

        {query.trim() &&
          suggestions.length > 0 && (
            <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {suggestions.map(
                (item) => (
                  <button
                    type="button"
                    key={`${item.source}-${item.email}`}
                    onClick={() =>
                      addOne(item)
                    }
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {item.name ||
                          item.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.email}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                      {sourceLabel(
                        item.source
                      )}
                    </span>
                  </button>
                )
              )}
            </div>
          )}

        {query.trim() &&
          searchError &&
          suggestions.length === 0 &&
          !searching && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {searchError}
              {isValidEmail(query) && (
                <button
                  type="button"
                  onClick={addManual}
                  className="ml-2 font-semibold underline"
                >
                  이 주소 직접 추가
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

export default function GeneralBulkMail() {
  const [toRecipients, setToRecipients] =
    useState<RecipientChip[]>([]);
  const [ccRecipients, setCcRecipients] =
    useState<RecipientChip[]>([]);
  const [bccRecipients, setBccRecipients] =
    useState<RecipientChip[]>([]);

  const [subject, setSubject] =
    useState("");
  const [body, setBody] =
    useState("");

  const [sending, setSending] =
    useState(false);
  const [previewing, setPreviewing] =
    useState(false);
  const [preview, setPreview] =
    useState<PreviewResult | null>(
      null
    );
  const [previewIndex, setPreviewIndex] =
    useState(0);
  const [
    reviewedPreviewEmails,
    setReviewedPreviewEmails,
  ] = useState<Set<string>>(
    () => new Set()
  );
  const [result, setResult] =
    useState<SendResult | null>(
      null
    );

  const previewItems =
    preview?.previews ?? [];
  const currentPreview =
    previewItems[previewIndex] ??
    null;

  const allPreviewsReviewed =
    previewItems.length > 0 &&
    reviewedPreviewEmails.size >=
      previewItems.length;

  const resetPreview = () => {
    setPreview(null);
    setPreviewIndex(0);
    setReviewedPreviewEmails(
      new Set()
    );
    setResult(null);
  };

  const requestApi = async (
    mode: "preview" | "send"
  ) => {
    const response = await fetch(
      "/api/gmail/send-general",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          mode,
          toRecipients,
          cc: ccRecipients.map(
            (item) => item.email
          ),
          bcc: bccRecipients.map(
            (item) => item.email
          ),
          subject,
          body,
        }),
      }
    );

    const text =
      await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `메일 API가 JSON이 아닌 응답을 반환했습니다. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      if (
        data.code ===
        "GMAIL_NOT_CONNECTED"
      ) {
        alert(
          "Gmail 계정 연결이 필요합니다.\n확인을 누르면 Gmail 연결 화면으로 이동합니다."
        );

        const returnTo =
          window.location.pathname +
          window.location.search;

        window.location.href =
          `/api/google/oauth/start?returnTo=${encodeURIComponent(
            returnTo
          )}`;

        const error = new Error(
          "GMAIL_REDIRECTING"
        );
        (
          error as Error & {
            code?: string;
          }
        ).code =
          "GMAIL_REDIRECTING";

        throw error;
      }

      throw new Error(
        data.error ||
          "메일 처리 중 오류가 발생했습니다."
      );
    }

    return data;
  };

  const requestPreview = async () => {
    if (
      toRecipients.length === 0
    ) {
      alert(
        "받는 사람을 한 명 이상 추가해주세요."
      );
      return;
    }

    if (!subject.trim()) {
      alert(
        "메일 제목을 입력해주세요."
      );
      return;
    }

    if (!body.trim()) {
      alert(
        "메일 본문을 입력해주세요."
      );
      return;
    }

    setPreviewing(true);

    try {
      const data =
        (await requestApi(
          "preview"
        )) as PreviewResult;

      if (
        !data.previews?.length
      ) {
        throw new Error(
          "생성된 메일 미리보기가 없습니다."
        );
      }

      setPreview(data);
      setPreviewIndex(0);

      const firstEmail =
        data.previews[0]
          ?.recipientEmail;

      setReviewedPreviewEmails(
        new Set(
          firstEmail
            ? [
                normalizeEmail(
                  firstEmail
                ),
              ]
            : []
        )
      );
    } catch (error) {
      const code = (
        error as Error & {
          code?: string;
        }
      )?.code;

      if (
        code !==
        "GMAIL_REDIRECTING"
      ) {
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

  const openPreviewAt = (
    index: number
  ) => {
    if (!previewItems.length) {
      return;
    }

    const nextIndex = Math.max(
      0,
      Math.min(
        index,
        previewItems.length - 1
      )
    );

    setPreviewIndex(nextIndex);

    const email =
      previewItems[nextIndex]
        ?.recipientEmail;

    if (email) {
      setReviewedPreviewEmails(
        (current) => {
          const next =
            new Set(current);
          next.add(
            normalizeEmail(email)
          );
          return next;
        }
      );
    }
  };

  const handleSend = async () => {
    if (sending) return;

    if (
      toRecipients.length === 0
    ) {
      alert(
        "받는 사람을 한 명 이상 추가해주세요."
      );
      return;
    }

    if (!previewItems.length) {
      alert(
        "먼저 메일 미리보기를 생성해주세요."
      );
      return;
    }

    if (!allPreviewsReviewed) {
      alert(
        `전체 미리보기를 확인해주세요. (${reviewedPreviewEmails.size}/${previewItems.length})`
      );
      return;
    }

    const confirmed =
      window.confirm(
        `받는 사람 ${toRecipients.length}명에게 동일한 내용의 메일을 각각 개별 발송하시겠습니까?`
      );

    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const data =
        (await requestApi(
          "send"
        )) as SendResult;

      setResult(data);
    } catch (error) {
      const code = (
        error as Error & {
          code?: string;
        }
      )?.code;

      if (
        code !==
        "GMAIL_REDIRECTING"
      ) {
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
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          <RecipientField
            label="받는 사람 (To)"
            description="각 주소로 동일한 내용의 메일을 한 통씩 개별 발송합니다."
            recipients={toRecipients}
            setRecipients={
              setToRecipients
            }
            disabled={sending}
            onChanged={
              resetPreview
            }
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <RecipientField
              label="참조 (CC)"
              description="모든 개별 메일에 공통 참조로 포함됩니다."
              recipients={
                ccRecipients
              }
              setRecipients={
                setCcRecipients
              }
              disabled={sending}
              onChanged={
                resetPreview
              }
            />

            <RecipientField
              label="숨은참조 (BCC)"
              description="모든 개별 메일에 일반 BCC로 공통 포함됩니다."
              recipients={
                bccRecipients
              }
              setRecipients={
                setBccRecipients
              }
              disabled={sending}
              onChanged={
                resetPreview
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              제목
            </label>

            <input
              type="text"
              value={subject}
              disabled={sending}
              onChange={(event) => {
                setSubject(
                  event.target.value
                );
                resetPreview();
              }}
              placeholder="메일 제목을 입력하세요."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              본문
            </label>

            <textarea
              value={body}
              disabled={sending}
              onChange={(event) => {
                setBody(
                  event.target.value
                );
                resetPreview();
              }}
              rows={14}
              placeholder="모든 수신자에게 동일하게 발송할 메일 내용을 입력하세요."
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-slate-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              일반 대량 메일에서는 캠페인명, 브랜드, 인플루언서명 등의
              자동 치환을 사용하지 않습니다. 작성한 제목과 본문이 그대로
              모든 수신자에게 발송됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div className="text-sm text-slate-500">
              받는 사람{" "}
              <strong className="text-slate-800">
                {toRecipients.length}명
              </strong>
            </div>

            <button
              type="button"
              onClick={
                requestPreview
              }
              disabled={
                previewing ||
                sending ||
                toRecipients.length ===
                  0
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {previewing
                ? "미리보기 생성 중..."
                : preview
                  ? "미리보기 다시 생성"
                  : "미리보기"}
            </button>
          </div>
        </div>
      </div>

      {preview &&
        currentPreview && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  발송 미리보기
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {previewIndex + 1} /{" "}
                  {previewItems.length}
                  {" · "}
                  확인 완료{" "}
                  {
                    reviewedPreviewEmails.size
                  }
                  /{previewItems.length}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPreviewAt(
                      previewIndex - 1
                    )
                  }
                  disabled={
                    previewIndex === 0
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-30"
                >
                  ← 이전
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openPreviewAt(
                      previewIndex + 1
                    )
                  }
                  disabled={
                    previewIndex >=
                    previewItems.length -
                      1
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-30"
                >
                  다음 →
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600">
                <p>
                  <strong>
                    보내는 사람:
                  </strong>{" "}
                  {preview.sender}
                </p>

                <p className="mt-1">
                  <strong>
                    받는 사람:
                  </strong>{" "}
                  {currentPreview.recipientName
                    ? `${currentPreview.recipientName} `
                    : ""}
                  {currentPreview.recipientEmail}
                </p>

                {currentPreview.cc
                  ?.length > 0 && (
                  <p className="mt-1">
                    <strong>
                      참조:
                    </strong>{" "}
                    {currentPreview.cc.join(
                      ", "
                    )}
                  </p>
                )}

                {currentPreview.bcc
                  ?.length > 0 && (
                  <p className="mt-1">
                    <strong>
                      숨은참조:
                    </strong>{" "}
                    {currentPreview.bcc.join(
                      ", "
                    )}
                  </p>
                )}

                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {
                    currentPreview.subject
                  }
                </p>
              </div>

              <iframe
                title={`메일 미리보기 ${
                  previewIndex + 1
                }`}
                srcDoc={
                  currentPreview.html
                }
                sandbox=""
                className="h-[460px] w-full bg-white"
              />
            </div>

            <div
              className={
                allPreviewsReviewed
                  ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                  : "mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              }
            >
              {allPreviewsReviewed
                ? "모든 수신자의 미리보기를 확인했습니다."
                : `아직 ${
                    previewItems.length -
                    reviewedPreviewEmails.size
                  }명의 미리보기를 확인해야 합니다.`}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleSend}
                disabled={
                  sending ||
                  !allPreviewsReviewed
                }
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending
                  ? "메일 발송 중..."
                  : `${toRecipients.length}명에게 발송`}
              </button>
            </div>
          </div>
        )}

      {result && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-900">
            발송 처리 완료
          </h2>

          <p className="mt-2 text-sm text-blue-800">
            전체 {result.total}명 ·
            발송 {result.sent}명 ·
            실패 {result.failed}명
          </p>

          {result.sender && (
            <p className="mt-1 text-xs text-blue-700">
              발송 계정:{" "}
              {result.sender}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
