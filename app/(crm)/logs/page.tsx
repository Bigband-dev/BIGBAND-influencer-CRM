import { createClient } from "@/lib/supabase/server";
import AuditLogTable from "@/components/audit-log-table";

export const instant = false;

export default async function LogsPage() {
  const supabase = await createClient();

  /*
   * 활동 로그는 500건을 넘을 수 있으므로
   * 500건씩 끝까지 페이지네이션해서 가져옵니다.
   */
  const logs: any[] = [];
  const LOG_PAGE_SIZE = 500;
  let logFrom = 0;
  let logLoadError: Error | null = null;

  while (true) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        logFrom,
        logFrom + LOG_PAGE_SIZE - 1
      );

    if (error) {
      logLoadError = new Error(error.message);
      break;
    }

    logs.push(...(data ?? []));

    if (!data || data.length < LOG_PAGE_SIZE) {
      break;
    }

    logFrom += LOG_PAGE_SIZE;
  }

  if (logLoadError) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-8">
        <h1 className="text-3xl font-bold">
          활동 로그
        </h1>

        <p className="mt-4 text-red-600">
          {logLoadError.message}
        </p>
      </div>
    );
  }

  const actorIds = Array.from(
    new Set(
      logs
        .map((log) => log.actor_id)
        .filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length > 0
        )
    )
  );

  let profiles: {
    id: string;
    name: string | null;
    email: string | null;
  }[] = [];

  if (actorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", actorIds);

    profiles = data ?? [];
  }

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ])
  );

  const rows = logs.map((log) => {
    const actor = log.actor_id
      ? profileMap.get(log.actor_id)
      : undefined;

    return {
      ...log,
      actor_name:
        actor?.name ?? null,
      actor_email:
        actor?.email ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          활동 로그
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          인플루언서, 캠페인 및 기타 데이터의 생성·수정·삭제 이력을 확인합니다.
        </p>
      </div>

      <AuditLogTable logs={rows} />
    </div>
  );
}