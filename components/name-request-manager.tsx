"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NameRequestManager({
  requests,
}: {
  requests: any[];
}) {
  const router = useRouter();

  const [loadingId, setLoadingId] =
    useState<string | null>(
      null
    );

  async function handleReview(
    id: string,
    action:
      | "approve"
      | "reject"
  ) {
    const adminNote =
      action === "reject"
        ? window.prompt(
            "거절 사유를 입력해주세요."
          ) || ""
        : "";

    if (
      action === "reject" &&
      !adminNote.trim()
    ) {
      return;
    }

    setLoadingId(id);

    try {
      const response =
        await fetch(
          `/api/admin/name-requests/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action,
              adminNote,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        alert(
          result.message ||
            "처리에 실패했습니다."
        );
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      alert(
        "처리 중 오류가 발생했습니다."
      );
    } finally {
      setLoadingId(null);
    }
  }

  const pending =
    requests.filter(
      (request) =>
        request.status ===
        "pending"
    );

  const completed =
    requests.filter(
      (request) =>
        request.status !==
        "pending"
    );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-300 bg-white p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            승인 대기
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {pending.length}건
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            승인 대기 중인 요청이 없습니다.
          </div>
        ) : (
          <RequestTable
            requests={pending}
            loadingId={
              loadingId
            }
            onReview={
              handleReview
            }
            showActions
          />
        )}
      </section>

      <section className="rounded-xl border border-slate-300 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">
          처리 내역
        </h2>

        <div className="mt-5">
          {completed.length ===
          0 ? (
            <div className="text-sm text-slate-500">
              처리된 요청이 없습니다.
            </div>
          ) : (
            <RequestTable
              requests={
                completed
              }
              loadingId={
                loadingId
              }
              onReview={
                handleReview
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function RequestTable({
  requests,
  loadingId,
  onReview,
  showActions = false,
}: {
  requests: any[];
  loadingId: string | null;
  onReview: (
    id: string,
    action:
      | "approve"
      | "reject"
  ) => void;
  showActions?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300 bg-slate-50 text-left">
            <th className="px-4 py-3">
              사용자
            </th>
            <th className="px-4 py-3">
              현재 이름
            </th>
            <th className="px-4 py-3">
              요청 이름
            </th>
            <th className="px-4 py-3">
              요청일
            </th>
            <th className="px-4 py-3">
              상태
            </th>

            {showActions && (
              <th className="px-4 py-3">
                관리
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {requests.map(
            (request) => {
              const profile =
                Array.isArray(
                  request.profiles
                )
                  ? request
                      .profiles[0]
                  : request.profiles;

              return (
                <tr
                  key={
                    request.id
                  }
                  className="border-b border-slate-200"
                >
                  <td className="px-4 py-3">
                    {profile?.email ||
                      "-"}
                  </td>

                  <td className="px-4 py-3">
                    {request.current_name ||
                      "-"}
                  </td>

                  <td className="px-4 py-3 font-semibold">
                    {
                      request.requested_name
                    }
                  </td>

                  <td className="px-4 py-3">
                    {new Date(
                      request.requested_at
                    ).toLocaleString(
                      "ko-KR"
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {request.status ===
                    "pending"
                      ? "대기"
                      : request.status ===
                        "approved"
                      ? "승인"
                      : "거절"}
                  </td>

                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={
                            loadingId ===
                            request.id
                          }
                          onClick={() =>
                            onReview(
                              request.id,
                              "approve"
                            )
                          }
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          승인
                        </button>

                        <button
                          type="button"
                          disabled={
                            loadingId ===
                            request.id
                          }
                          onClick={() =>
                            onReview(
                              request.id,
                              "reject"
                            )
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          거절
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}