import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, findBackup, getJob, requireRestoreRole, type RestoreItem } from "@/lib/backup/restore";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status = message === "FORBIDDEN" ? 403 : message.startsWith("INVALID_") ? 400 : message === "JOB_NOT_FOUND" ? 404 : 500;
  console.error("Restore API error:", message);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRestoreRole(false);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const result = await getJob(id, user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host")) {
      return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    const body = await request.json();
    const mode = body?.mode;
    if (mode !== "preview" && mode !== "apply") {
      return NextResponse.json({ error: "INVALID_MODE" }, { status: 400 });
    }
    const user = await requireRestoreRole(mode === "apply");
    const backupId: string = body?.backupId;
    await findBackup(backupId);
    if (mode === "preview") {
      const id = await createJob({ userId: user.id, backupId, mode });
      return NextResponse.json({ id }, { status: 202 });
    }
    // Never overwrite existing records; only restore rows confirmed missing in a recent preview.
    if (body?.confirmation !== "RESTORE") {
      return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
    }
    const selection = body?.selection;
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
      return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
    }
    const allowed = ["influencers", "campaigns"];
    if (Object.keys(selection).some((t) => !allowed.includes(t))) {
      return NextResponse.json({ error: "INVALID_SELECTION_TABLE" }, { status: 400 });
    }
    const ids: Record<string, string[]> = { influencers: [], campaigns: [] };
    for (const t of allowed) {
      const values = selection[t] ?? [];
      if (!Array.isArray(values) || values.length > 100 || values.some((v) => typeof v !== "string" || !/^[\w-]{1,128}$/.test(v))) {
        return NextResponse.json({ error: "INVALID_SELECTION_IDS" }, { status: 400 });
      }
      ids[t] = [...new Set(values)];
    }
    if (ids.influencers.length + ids.campaigns.length === 0) {
      return NextResponse.json({ error: "NO_ITEMS_SELECTED" }, { status: 400 });
    }
    const previewId = body?.previewId;
    if (typeof previewId !== "string") return NextResponse.json({ error: "PREVIEW_REQUIRED" }, { status: 400 });
    const db = createAdminClient();
    const { data: previous } = await db.from("crm_restore_jobs")
      .select("id,backup_id,status,preview,created_at")
      .eq("id", previewId).eq("requested_by", user.id).eq("mode", "preview").single();
    if (!previous || previous.status !== "ready" || previous.backup_id !== backupId ||
        Date.now() - new Date(previous.created_at).getTime() > 60 * 60 * 1000) {
      return NextResponse.json({ error: "PREVIEW_EXPIRED" }, { status: 409 });
    }
    const eligible = new Set(((previous.preview ?? []) as RestoreItem[])
      .filter((item) => item.status === "missing")
      .map((item) => `${item.table}:${item.id}`));
    if (allowed.some((table) => ids[table].some((id) => !eligible.has(`${table}:${id}`)))) {
      return NextResponse.json({ error: "SELECTION_CONFLICT" }, { status: 409 });
    }
    const id = await createJob({ userId: user.id, backupId, mode, selection: ids,
      previewId, confirmation: "RESTORE" });
    return NextResponse.json({ id }, { status: 202 });
  } catch (error) { return failure(error); }
}
