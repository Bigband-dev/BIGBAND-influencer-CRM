"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  is_active: boolean | null;
  created_at: string | null;
};

export default function UserRoleManager({
  users,
  currentUserId,
  currentUserRole,
}: {
  users: UserRow[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");

  const updateRole = async (
    userId: string,
    role: "admin" | "member"
  ) => {
    const target = users.find(
      (user) => user.id === userId
    );

    if (!target) return;

    if (target.role === "owner") {
      alert("Owner 계정의 권한은 변경할 수 없습니다.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  };
  const updateStatus = async (
    userId: string,
    isActive: boolean
  ) => {
    const target = users.find(
      (user) => user.id === userId
    );

    if (!target) return;

    if (target.role === "owner") {
      alert(
        "Owner 계정은 비활성화할 수 없습니다."
      );
      return;
    }

    if (
      userId === currentUserId &&
      isActive === false
    ) {
      alert(
        "현재 로그인한 자신의 계정은 비활성화할 수 없습니다."
      );
      return;
    }

    const actionText = isActive
      ? "활성화"
      : "비활성화";

    const confirmed = window.confirm(
      `${target.email || target.name} 계정을 ${actionText}하시겠습니까?`
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: isActive,
      })
      .eq("id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  };

  const deleteUser = async (
    userId: string,
    email: string | null
  ) => {
    const confirmed = window.confirm(
      `${email || "이 사용자"} 계정을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/users/${userId}`,
        {
          method: "DELETE",
        }
      );

      const text = await response.text();

      let result;

      try {
        result = JSON.parse(text);
      } catch {
        console.error(
          "Delete user API returned non-JSON:",
          response.status,
          text
        );

        alert(
          `계정 삭제 API 오류 (${response.status})`
        );

        return;
      }

      if (!response.ok || !result.ok) {
        alert(
          result.message ||
            "계정 삭제에 실패했습니다."
        );

        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      alert(
        "계정 삭제 중 오류가 발생했습니다."
      );
    }
  };

  const filteredUsers = users.filter((user) => {
    if (statusFilter === "active") {
      return user.is_active === true;
    }

    if (statusFilter === "inactive") {
      return user.is_active === false;
    }

    return true;
  });

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
        <div className="flex gap-2 border-b border-slate-300 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              statusFilter === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            전체
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              statusFilter === "active"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            활성
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              statusFilter === "inactive"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            비활성
          </button>
        </div>
      <table className="w-full text-sm">
        <thead className="border-b-2 border-slate-500 bg-slate-100">
          <tr>
            <th className="px-5 py-4 text-left">
              이름
            </th>
            <th className="px-5 py-4 text-left">
              이메일
            </th>
            <th className="px-5 py-4 text-left">
              상태
            </th>

            <th className="px-5 py-4 text-left">
              권한
            </th>

            <th className="px-5 py-4 text-left">
              관리
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-300">
          {filteredUsers.map((user) => (
            <tr key={user.id}>
              {/* 이름 */}
              <td className="px-5 py-4 font-semibold">
                {user.name || "-"}
              </td>

              {/* 이메일 */}
              <td className="px-5 py-4">
                {user.email || "-"}
              </td>

              {/* 상태 */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  {user.is_active ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      활성
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      비활성
                    </span>
                  )}

                  {user.role !== "owner" &&
                    user.id !== currentUserId && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            user.id,
                            !user.is_active
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          user.is_active
                            ? "border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
                            : "border-green-300 bg-white text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {user.is_active
                          ? "비활성화"
                          : "활성화"}
                      </button>
                    )}
                </div>
              </td>

              {/* 권한 */}
              <td className="px-5 py-4">
                {user.role === "owner" ? (
                  <span className="text-xs font-semibold text-slate-500">
                    Owner
                  </span>
                ) : (
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateRole(
                        user.id,
                        e.target.value as "admin" | "member"
                      )
                    }
                    className="rounded-lg border border-slate-400 bg-white px-3 py-2"
                  >
                    <option value="member">
                      Member
                    </option>

                    <option value="admin">
                      Admin
                    </option>
                  </select>
                )}
              </td>

              {/* 관리 */}
              <td className="px-5 py-4">
                {!user.is_active &&
                user.role !== "owner" &&
                user.id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() =>
                      deleteUser(
                        user.id,
                        user.email
                      )
                    }
                    className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    -
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}