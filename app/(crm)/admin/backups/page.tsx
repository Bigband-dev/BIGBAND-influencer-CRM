import { redirect } from "next/navigation";
import { getActiveUser } from "@/lib/auth/require-active-user";
import { isAdmin, isOwner } from "@/lib/auth/roles";
import { listCrmBackups } from "@/lib/backup/drive";
import BackupsClient from "./backups-client";

export default async function BackupManagementPage() {
  const { user, profile } = await getActiveUser();
  if (!user) redirect("/login");
  if (!isAdmin(profile?.role)) redirect("/influencers");
  let backups: Awaited<ReturnType<typeof listCrmBackups>> = [];
  let error = "";
  try { backups = await listCrmBackups(); }
  catch (cause) {
    console.error("Drive listing failed:", cause instanceof Error ? cause.message : "unknown");
    error = "백업 목록을 불러오지 못했습니다. 관리자에게 문의해 주세요.";
  }
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <h1 className="text-3xl font-bold">백업 관리</h1>
      <p className="mt-2 text-slate-600">날짜를 선택해 백업 내용을 확인하고, 필요한 항목을 복구할 수 있습니다.</p>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        삭제된 인플루언서나 캠페인을 다시 가져올 때 사용합니다. 현재 목록에 있는 항목은 변경되지 않습니다.
      </p>
      {error ? <p role="alert" className="mt-5 text-red-700">{error}</p> : <BackupsClient backups={backups} canApply={isOwner(profile?.role)} />}
    </div>
  );
}
