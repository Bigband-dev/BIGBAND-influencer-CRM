"use client";

import { useEffect, useState } from "react";

type GmailStatus = {
  connected: boolean;
  email?: string | null;
  error?: string;
};

export default function GmailConnectionCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/gmail/connection", { cache: "no-store" });
        const data = (await response.json()) as GmailStatus;

        if (!response.ok) {
          throw new Error(data.error || "Gmail 연결 상태를 확인하지 못했습니다.");
        }

        setStatus(data);
      } catch (error) {
        setStatus({
          connected: false,
          error: error instanceof Error
            ? error.message
            : "Gmail 연결 상태를 확인하지 못했습니다.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Gmail 연결</h2>
            {!loading && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  status?.connected
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {status?.connected ? "연결됨" : "미연결"}
              </span>
            )}
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            캠페인 메일은 각 마케터가 본인 Gmail 계정을 연결한 뒤
            해당 계정에서 직접 발송됩니다.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">
              연결 상태를 확인하고 있습니다.
            </p>
          ) : status?.connected ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">연결된 Gmail</p>
              <p className="mt-1 text-sm text-emerald-700">{status.email}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                Gmail 연결이 필요합니다.
              </p>
              <p className="mt-1 text-sm leading-5 text-amber-700">
                캠페인에서 메일 미리보기와 발송 기능을 사용하려면
                먼저 Gmail 계정을 연결해주세요.
              </p>
            </div>
          )}

          {status?.error && (
            <p className="mt-3 text-sm text-red-600">{status.error}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/api/google/oauth/start";
          }}
          disabled={loading}
          className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {status?.connected ? "Gmail 다시 연결" : "Gmail 연결하기"}
        </button>
      </div>
    </section>
  );
}
