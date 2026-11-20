import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth/require-active-user";
import { isAdmin } from "@/lib/auth/roles";
import { listCrmBackups } from "@/lib/backup/drive";

export async function POST(request: NextRequest) {
  const { user, profile } = await getActiveUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(profile?.role)) return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  // Browser Origin validation prevents cross-site form posts against the authenticated session.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host || new URL(origin).protocol !== request.nextUrl.protocol) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  const githubToken = process.env.GITHUB_BACKUP_ACTIONS_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO ?? "Bigband-dev/BIGBAND-influencer-CRM";
  const ref = process.env.GITHUB_BACKUP_RESTORE_REF ?? "main";
  if (!githubToken || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(ref)) {
    return NextResponse.json({ error: "GitHub Actions 설정이 누락되었거나 올바르지 않습니다." }, { status: 503 });
  }

  let data: { backupId?: unknown };
  try { data = await request.json(); } catch { return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  if (typeof data.backupId !== "string" || !/^[A-Za-z0-9_-]{8,256}$/.test(data.backupId)) {
    return NextResponse.json({ error: "올바르지 않은 백업 ID입니다." }, { status: 400 });
  }

  try {
    // Prevent arbitrary Drive file IDs from being submitted by the browser.
    const backups = await listCrmBackups();
    if (!backups.some((backup) => backup.id === data.backupId)) {
      return NextResponse.json({ error: "백업 목록에서 파일을 찾지 못했습니다." }, { status: 404 });
    }
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/crm-backup-verify.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref, inputs: { backup_id: data.backupId } }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("GitHub dispatch failed", response.status);
      return NextResponse.json({ error: "GitHub 작업을 실행하지 못했습니다. 워크플로 파일과 Actions 토큰 권한을 확인하세요." }, { status: 502 });
    }
    return NextResponse.json({ queued: true });
  } catch (err) {
    console.error("Backup verification request failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "복원 검증 요청 중 오류가 발생했습니다." }, { status: 500 });
  }
}
