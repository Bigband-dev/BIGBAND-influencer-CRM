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
    error = "백업 목록을 불러오지 못했습니다. Vercel의 Drive 서비스 계정과 폴더 권한을 확인하세요.";
  }
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <h1 className="text-3xl font-bold">백업 관리 · 선택 복원</h1>
      <p className="mt-2 text-slate-600">백업을 선택하고, 삭제된 항목을 확인한 다음 소유자 승인으로 복원합니다.</p>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        기존 레코드는 덮어쓰지 않습니다. 실수로 삭제된 인플루언서·캠페인 복구에만 사용하세요. 백업 시점 이후 변경사항을 되돌리는 기능은 아닙니다.
      </p>
      {error ? <p role="alert" className="mt-5 text-red-700">{error}</p> : <BackupsClient backups={backups} canApply={isOwner(profile?.role)} />}
    </div>
  );
}
