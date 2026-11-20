"use client";

import { useEffect, useMemo, useState } from "react";
import type { Backup } from "@/lib/backup/drive";
import type { RestoreItem, RestoreJob } from "@/lib/backup/restore";

export default function BackupsClient({ backups, canApply }: { backups: Backup[]; canApply: boolean }) {
  const [backupId, setBackupId] = useState(backups[0]?.id ?? "");
  const [job, setJob] = useState<RestoreJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("missing");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/backups/restore?id=${encodeURIComponent(job.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("작업 상태 조회 실패");
        const result = await response.json() as RestoreJob;
        if (active) {
          setJob(result);
          if (result.mode === "preview" && result.status === "ready") setPreviewId(result.id);
        }
      } catch { if (active) setNotice("작업 상태를 확인하지 못했습니다. 새로고침 후 다시 확인하세요."); }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [job?.id, job?.status]);

  const items = useMemo(() => (job?.mode === "preview" ? (job.preview ?? []) : []) as RestoreItem[], [job]);
  const eligible = items.filter((r) => r.status === "missing");
  const displayed = items.filter((r) =>
    (filter === "all" || r.status === filter) &&
    `${r.name} ${r.id} ${r.table}`.toLowerCase().includes(query.toLowerCase())
  );

  async function verify() {
    if (!backupId) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/backups/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "검증 요청 실패");
      setNotice("기존 파일 무결성 검증을 요청했습니다. GitHub Actions에서 결과를 확인하세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "검증 실패");
    } finally { setBusy(false); }
  }

  async function submit(body: unknown) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/backups/restore", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "복원 요청을 처리하지 못했습니다.");
      setJob({ id: result.id, mode: (body as {mode:string}).mode, backup_id: backupId,
        status: "queued", preview: null, result: null, error: null, created_at: new Date().toISOString() });
      setNotice("GitHub Actions에서 작업을 실행하고 있습니다. 잠시 후 상태가 자동 갱신됩니다.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "오류가 발생했습니다."); }
    finally { setBusy(false); }
  }

  function selectBackup(id: string) {
    setBackupId(id); setJob(null); setPreviewId(null); setSelected([]); setConfirm(""); setQuery(""); setNotice("");
  }
  function toggle(row: RestoreItem) {
    const key = `${row.table}:${row.id}`;
    setSelected((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  }
  function apply() {
    if (!canApply || !previewId || !job || job.mode !== "preview" || job.status !== "ready" || confirm !== "RESTORE") return;
    const selection = { influencers: [] as string[], campaigns: [] as string[] };
    for (const item of eligible) {
      if (selected.includes(`${item.table}:${item.id}`)) selection[item.table].push(item.id);
    }
    void submit({ mode: "apply", backupId, previewId, selection, confirmation: confirm });
  }

  return <div className="mt-6 space-y-5">
    <section className="rounded-xl border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold">1. 백업 선택</h2>
      <select aria-label="백업 파일" className="mt-3 w-full rounded-lg border p-3" value={backupId} onChange={(e) => selectBackup(e.target.value)}>
        {backups.map((b) => <option key={b.id} value={b.id}>{b.name} · {(b.size/1048576).toFixed(1)} MB</option>)}
      </select>
      <button type="button" disabled={!backupId || busy} onClick={() => void verify()} className="mt-3 mr-2 rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-800 disabled:opacity-40">파일 무결성 검증</button>
      <button type="button" disabled={!backupId || busy || job?.status === "running" || job?.status === "queued"}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        onClick={() => { setSelected([]); setPreviewId(null); void submit({ mode: "preview", backupId }); }}>
        백업 데이터 미리보기
      </button>
    </section>
    {notice && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{notice}</p>}
    {job && <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">작업 상태: {job.status}</h2>
      {job.error && <p role="alert" className="mt-2 text-red-700">{job.error}</p>}
      {job.status === "completed" && <p className="mt-2 text-emerald-700">선택 복원이 완료되었습니다. 복원된 레코드는 CRM에서 확인할 수 있습니다.</p>}
      {job.result && <pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(job.result, null, 2)}</pre>}
    </section>}
    {job?.status === "ready" && job.mode === "preview" && <section className="rounded-xl border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold">2. 복원할 항목 선택</h2>
      <p className="mt-1 text-sm text-slate-600">삭제되어 현재 DB에 없는 항목 {eligible.length}개. 기존 항목은 복원하지 않습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input aria-label="이름 검색" placeholder="인플루언서 또는 캠페인 검색" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-64 flex-1 rounded border p-2" />
        <select aria-label="목록 필터" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border p-2">
          <option value="missing">삭제된 항목</option><option value="exists">현재 존재하는 항목</option><option value="all">전체</option>
        </select>
      </div>
      <div className="mt-3 max-h-96 divide-y overflow-y-auto rounded border">
        {displayed.slice(0, 500).map((item) => <label key={`${item.table}:${item.id}`} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
          <input type="checkbox" disabled={item.status !== "missing" || !canApply} checked={selected.includes(`${item.table}:${item.id}`)} onChange={() => toggle(item)} />
          <span className="w-24 shrink-0 text-xs text-slate-500">{item.table === "influencers" ? "인플루언서" : "캠페인"}</span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className={item.status === "missing" ? "text-amber-700" : "text-emerald-700"}>{item.status === "missing" ? "삭제됨" : "존재함"}</span>
        </label>)}
        {displayed.length > 500 && <p className="p-3 text-xs text-slate-500">상위 500개만 표시됩니다. 검색을 이용해 주세요.</p>}
      </div>
      {canApply ? <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-semibold">3. 선택 복원 실행 (소유자 전용)</h3>
        <p className="mt-1 text-sm">선택한 {selected.length}개 항목 및 관련 채널·단가·캠페인 연결 데이터를 함께 복원합니다. 충돌이나 관계 오류가 있으면 전체 작업을 취소합니다.</p>
        <p className="mt-1 text-xs text-amber-800">실제 DB에 새로운 행이 삽입됩니다. 복원 전 다른 작업자가 데이터를 편집하지 않는 시간에 진행하세요.</p>
        <input aria-label="복원 확인 문구" placeholder="RESTORE 입력" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-3 rounded border p-2" />
        <button type="button" disabled={!selected.length || selected.length > 100 || busy || confirm !== "RESTORE"}
          onClick={apply} className="ml-2 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-40">선택한 데이터 복원</button>
      </div> : <p className="mt-4 text-sm text-slate-600">실제 복원은 Owner 계정에서만 실행할 수 있습니다.</p>}
    </section>}
  </div>;
}
