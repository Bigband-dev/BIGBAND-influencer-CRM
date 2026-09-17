"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingRequest = {
  id: string;
  current_name: string | null;
  requested_name: string;
  status: string;
  requested_at: string;
  admin_note: string | null;
};

export default function NameChangeRequestForm({
  currentName,
  pendingRequest,
}: {
  currentName: string;
  pendingRequest: PendingRequest | null;
}) {
  const router = useRouter();

  const [requestedName, setRequestedName] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function handleSubmit() {
    setMessage("");

    const nextName =
      requestedName.trim();

    if (!nextName) {
      setMessage(
        "변경할 이름을 입력해주세요."
      );
      return;
    }

    if (nextName === currentName) {
      setMessage(
        "현재 이름과 동일합니다."
      );
      return;
    }

    if (nextName.length > 50) {
      setMessage(
        "이름은 50자 이하로 입력해주세요."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/account/name-change-request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            requestedName: nextName,
          }),
        }
      );

      const text = await response.text();

      let result;

      try {
      result = JSON.parse(text);
      } catch {
      console.error(
          "Name change API returned non-JSON:",
          response.status,
          text
      );

      setMessage(
          `이름 변경 API 오류 (${response.status})`
      );

      return;
      }

      if (
        !response.ok ||
        !result.ok
      ) {
        setMessage(
          result.message ||
            "이름 변경 요청에 실패했습니다."
        );
        return;
      }

      setRequestedName("");

      setMessage(
        "이름 변경 요청이 등록되었습니다."
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">
        이름 변경
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        이름 변경은 관리자 승인 후 적용됩니다.
      </p>

      {pendingRequest ? (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            승인 대기 중
          </div>

          <div className="mt-3 text-sm text-slate-700">
            {pendingRequest.current_name ||
              "-"}{" "}
            →{" "}
            <strong>
              {
                pendingRequest.requested_name
              }
            </strong>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            관리자가 확인할 때까지 새로운
            요청을 등록할 수 없습니다.
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              변경할 이름
            </label>

            <input
              value={requestedName}
              onChange={(e) =>
                setRequestedName(
                  e.target.value
                )
              }
              placeholder="예: 김민지"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading
                ? "신청 중..."
                : "이름 변경 신청"}
            </button>
          </div>
        </>
      )}

      {message && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      )}
    </div>
  );
}