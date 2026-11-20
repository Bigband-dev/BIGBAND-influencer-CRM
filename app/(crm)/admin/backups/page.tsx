import { redirect } from "next/navigation";
import { getActiveUser } from "@/lib/auth/require-active-user";
import { isAdmin } from "@/lib/auth/roles";
import { listCrmBackups } from "@/lib/backup/drive";
import BackupsClient from "./backups-client";

export default async function BackupManagementPage() {
  const { user, profile } = await getActiveUser();
  if (!user) redirect("/login");
  if (!isAdmin(profile?.role)) redirect("/influencers");
  let backups: Awaited<ReturnType<typeof listCrmBackups>> = [];
  let error = "";
  try {
    backups = await listCrmBackups();
  } catch (err) {
    console.error("Backup Drive listing error:", err instanceof Error ? err.message : "unknown");
    error = "백업 목록을 불러오지 못했습니다. Vercel의 Drive 인증 환경변수와 공유 드라이브 권한을 확인하세요.";
  }
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-bold">데이터 백업 관리</h1>
      <p className="mt-2 text-slate-600">매주 일요일 오전 3시 백업 · 최신 12개 보관</p>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        복원 검증은 운영 데이터베이스를 수정하지 않습니다. 실제 데이터 복구는 별도 승인 및 격리 복원이 필요합니다.
      </div>
      {error ? <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p> : <BackupsClient backups={backups} />}
    </div>
  );
}
