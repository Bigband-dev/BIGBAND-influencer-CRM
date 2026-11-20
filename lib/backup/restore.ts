import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveUser } from "@/lib/auth/require-active-user";
import { isAdmin, isOwner } from "@/lib/auth/roles";
import { listCrmBackups } from "@/lib/backup/drive";

export type RestoreItem = { table: "influencers" | "campaigns"; id: string; name: string; status: "exists" | "missing" };
export type RestoreJob = {
  id: string; status: string; mode: string; backup_id: string;
  preview: RestoreItem[] | null; error: string | null;
  result: Record<string, number> | null; created_at: string;
};

export async function requireRestoreRole(apply = false) {
  const { user, profile } = await getActiveUser();
  if (!user || !profile?.is_active || !(apply ? isOwner(profile.role) : isAdmin(profile.role))) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function findBackup(backupId: string) {
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(backupId)) throw new Error("INVALID_BACKUP");
  const backup = (await listCrmBackups()).find((b) => b.id === backupId);
  if (!backup) throw new Error("BACKUP_NOT_FOUND");
  return backup;
}

export async function dispatchRestoreJob(jobId: string) {
  const token = process.env.GITHUB_BACKUP_ACTIONS_TOKEN;
  const repo = process.env.GITHUB_BACKUP_REPO ?? "Bigband-dev/BIGBAND-influencer-CRM";
  const ref = process.env.GITHUB_BACKUP_RESTORE_REF ?? "main";
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(ref)) {
    throw new Error("GITHUB_ACTIONS_NOT_CONFIGURED");
  }
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/crm-selective-restore.yml/dispatches`, {
    method: "POST", cache: "no-store",
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ ref, inputs: { job_id: jobId } }),
  });
  if (!response.ok) {
    console.error("GitHub dispatch HTTP", response.status);
    throw new Error(`GITHUB_DISPATCH_FAILED_${response.status}`);
  }
}

export async function createJob(args: { userId: string; backupId: string; mode: "preview" | "apply"; selection?: Record<string, string[]>; previewId?: string; confirmation?: string }) {
  const db = createAdminClient();
  const { data, error } = await db.from("crm_restore_jobs").insert({
    requested_by: args.userId, backup_id: args.backupId, mode: args.mode,
    selection: args.selection ?? null, source_preview_id: args.previewId ?? null,
    confirmation: args.confirmation ?? null, status: "queued",
  }).select("id").single();
  if (error || !data) throw new Error("JOB_CREATE_FAILED: " + (error?.message ?? "unknown"));
  try { await dispatchRestoreJob(data.id); }
  catch (error) {
    await db.from("crm_restore_jobs").update({ status: "failed", error: "GitHub 실행 요청 실패" }).eq("id", data.id);
    throw error;
  }
  return data.id as string;
}

export async function getJob(id: string, requester: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_JOB");
  const db = createAdminClient();
  const { data, error } = await db.from("crm_restore_jobs")
    .select("id,mode,status,backup_id,preview,result,error,created_at")
    .eq("id", id).eq("requested_by", requester).single();
  if (error || !data) throw new Error("JOB_NOT_FOUND");
  return data as RestoreJob;
}
