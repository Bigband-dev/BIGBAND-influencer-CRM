"use client";

import { useEffect, useMemo, useState } from "react";
import type { Backup } from "@/lib/backup/drive";
import type { RestoreItem, RestoreJob } from "@/lib/backup/restore";

function backupLabel(name: string): string {
  const match = name.match(/crm_supabase_(\d{4})(\d{2})(\d{2})T\d{6}/);
  if (match) return `${match[1]}-${match[2]}-${match[3]} 백업본`;
  const matchDate = name.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  return matchDate ? `${matchDate[1]}-${matchDate[2]}-${matchDate[3]} 백업본` : "날짜 확인이 필요한 백업본";
}

function statusLabel(status: string): string {
  switch (status) {
    case "queued": return "준비 중";
    case "running": return "확인 중";
    case "ready": return "확인 완료";
    case "completed": return "복구 완료";
    case "failed": return "처리 실패";
    default: return "상태 확인 중";
  }
}

export default function BackupsClient({ backups, canApply }: { backups: Backup[]; canApply: boolean }) {
  const [backupId, setBackupId] = useState(backups[0]?.id ?? "");
  const [job, setJob] = useState<RestoreJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("missing");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/backups/restore?id=${encodeURIComponent(job.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("진행 상황을 불러오지 못했습니다.");
        const result = await response.json() as RestoreJob;
        if (active) {
          setJob(result);
          if (result.mode === "preview" && result.status === "ready") setPreviewId(result.id);
        }
      } catch { if (active) setNotice("진행 상황을 확인할 수 없습니다. 페이지를 새로고침해 주세요."); }
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
      if (!response.ok) throw new Error(payload.error ?? "백업 확인을 시작하지 못했습니다.");
      setNotice("백업 파일 확인을 시작했습니다.");
    } catch (error) {
      console.error("Backup verification request failed", error);
      setNotice("백업 파일 확인을 시작하지 못했습니다. 관리자에게 문의해 주세요.");
    } finally { setBusy(false); }
  }

  async function submit(body: unknown) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/backups/restore", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "요청을 처리하지 못했습니다.");
      setJob({ id: result.id, mode: (body as {mode:string}).mode, backup_id: backupId,
        status: "queued", preview: null, result: null, error: null, created_at: new Date().toISOString() });
      setNotice("요청을 받았습니다. 완료되면 결과가 표시됩니다.");
    } catch (error) { console.error("Backup request failed", error); setNotice("요청을 처리하지 못했습니다. 관리자에게 문의해 주세요."); }
    finally { setBusy(false); }
  }

  function selectBackup(id: string) {
    setBackupId(id); setJob(null); setPreviewId(null); setSelected([]); setQuery(""); setNotice("");
  }
  function toggle(row: RestoreItem) {
    const key = `${row.table}:${row.id}`;
    setSelected((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  }
  function apply() {
    if (!canApply || !previewId || !job || job.mode !== "preview" || job.status !== "ready") return;
    const selection = { influencers: [] as string[], campaigns: [] as string[] };
    for (const item of eligible) {
      if (selected.includes(`${item.table}:${item.id}`)) selection[item.table].push(item.id);
    }
    void submit({ mode: "apply", backupId, previewId, selection, confirmation: "RESTORE" });
  }

  return <div className="mt-6 space-y-5">
    <section className="rounded-xl border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold">1. 날짜 선택</h2>
      <select aria-label="백업 날짜" className="mt-3 w-full rounded-lg border p-3" value={backupId} onChange={(e) => selectBackup(e.target.value)}>
        {backups.map((b) => <option key={b.id} value={b.id}>{backupLabel(b.name)}</option>)}
      </select>
      <button type="button" disabled={!backupId || busy} onClick={() => void verify()} className="mt-3 mr-2 rounded-lg border border-slate-400 px-4 py-2 font-semibold text-slate-800 disabled:opacity-40">백업 파일 확인</button>
      <button type="button" disabled={!backupId || busy || job?.status === "running" || job?.status === "queued"}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        onClick={() => { setSelected([]); setPreviewId(null); void submit({ mode: "preview", backupId }); }}>
        백업 내용 보기
      </button>
    </section>
    {notice && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{notice}</p>}
    {job && <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">진행 상황: {statusLabel(job.status)}</h2>
      {job.error && <p role="alert" className="mt-2 text-red-700">처리 중 문제가 발생했습니다. 관리자에게 문의해 주세요.</p>}
      {job.status === "completed" && <p className="mt-2 text-emerald-700">선택한 항목을 복구했습니다. 목록에서 확인해 주세요.</p>}
      {job.result && job.mode === "preview" && job.status === "ready" && (
        <p className="mt-2 text-sm text-slate-600">총 {items.length.toLocaleString("ko-KR")}개 항목을 확인했습니다.</p>
      )}
      {job.result && job.mode === "apply" && job.status === "completed" && (
        <p className="mt-2 text-sm text-slate-600">복구한 항목: {Object.values(job.result).reduce((sum, count) => sum + (typeof count === "number" ? count : 0), 0).toLocaleString("ko-KR")}개</p>
      )}
    </section>}
    {job?.status === "ready" && job.mode === "preview" && <section className="rounded-xl border border-slate-300 bg-white p-5">
      <h2 className="text-xl font-semibold">2. 복구할 항목 선택</h2>
      <p className="mt-1 text-sm text-slate-600">복구할 수 있는 항목 {eligible.length.toLocaleString("ko-KR")}개 · 현재 목록에 없는 항목만 복구할 수 있습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input aria-label="이름 검색" placeholder="인플루언서 또는 캠페인 검색" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-64 flex-1 rounded border p-2" />
        <select aria-label="목록 필터" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border p-2">
          <option value="missing">복구 가능한 항목</option><option value="exists">이미 있는 항목</option><option value="all">전체</option>
        </select>
      </div>
      <div className="mt-3 max-h-96 divide-y overflow-y-auto rounded border">
        {displayed.slice(0, 500).map((item) => <label key={`${item.table}:${item.id}`} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
          <input type="checkbox" disabled={item.status !== "missing" || !canApply} checked={selected.includes(`${item.table}:${item.id}`)} onChange={() => toggle(item)} />
          <span className="w-24 shrink-0 text-xs text-slate-500">{item.table === "influencers" ? "인플루언서" : "캠페인"}</span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className={item.status === "missing" ? "text-amber-700" : "text-emerald-700"}>{item.status === "missing" ? "복구 가능" : "복구 불필요"}</span>
        </label>)}
        {displayed.length > 500 && <p className="p-3 text-xs text-slate-500">한 번에 500개까지 표시됩니다. 이름으로 검색해 주세요.</p>}
      </div>
      {canApply ? <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-semibold">3. 선택한 항목 복구</h3>
        <p className="mt-1 text-sm">선택한 {selected.length}개 항목과 연결된 정보도 함께 복구합니다. 문제가 있으면 변경되지 않습니다.</p>
        <p className="mt-1 text-xs text-amber-800">복구할 항목을 확인한 후 버튼을 눌러 주세요.</p>
        {selected.length > 100 && <p className="mt-2 text-sm text-amber-900">한 번에 최대 100개까지 복구할 수 있습니다.</p>}
        <button type="button" disabled={!selected.length || selected.length > 100 || busy}
          onClick={apply} className="ml-2 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-40">선택한 항목 복구</button>
      </div> : <p className="mt-4 text-sm text-slate-600">항목 복구는 최고 관리자만 할 수 있습니다.</p>}
    </section>}
  </div>;
}
