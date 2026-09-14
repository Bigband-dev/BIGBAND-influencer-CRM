"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  return (
    <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
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
              권한
            </th>
            <th className="px-5 py-4 text-left">
              관리
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-300">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-5 py-4 font-semibold">
                {user.name || "-"}
              </td>

              <td className="px-5 py-4">
                {user.email || "-"}
              </td>

              <td className="px-5 py-4">
                {user.role}
              </td>

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
                        e.target.value as
                          | "admin"
                          | "member"
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
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}