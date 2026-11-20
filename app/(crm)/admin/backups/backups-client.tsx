"use client";

import { useState } from "react";
import type { Backup } from "@/lib/backup/drive";

export default function BackupsClient({ backups }: { backups: Backup[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function verify(backupId: string) {
    setBusy(backupId);
    setNotice("");
    try {
      const response = await fetch("/api/admin/backups/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "복원 검증 요청 실패");
      setNotice("복원 검증을 요청했습니다. GitHub Actions의 CRM backup verification 실행 기록에서 결과를 확인하세요.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-300 bg-white p-6">
      <h2 className="text-xl font-bold">Google Drive 백업 목록</h2>
      {notice && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">{notice}</p>}
      {backups.length === 0 ? (
        <p className="mt-4 text-slate-600">백업 파일이 없습니다.</p>
      ) : (
        <div className="mt-5 divide-y">
          {backups.map((backup) => (
            <div key={backup.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <p className="font-semibold">{backup.name}</p>
                <p className="text-sm text-slate-500">{backup.createdTime ? new Date(backup.createdTime).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "날짜 미확인"} · {(backup.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => verify(backup.id)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === backup.id ? "요청 중…" : "복원 가능 여부 검증"}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 text-sm text-slate-500">검증은 암호화 및 파일 무결성 검사만 수행합니다. 운영 데이터 반영 버튼은 안전한 복원 절차 검증 후 추가합니다.</p>
    </div>
  );
}
