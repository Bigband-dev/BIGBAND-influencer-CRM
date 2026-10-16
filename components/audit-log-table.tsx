"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;

  action:
    | "INSERT"
    | "UPDATE"
    | "DELETE";

  table_name: string;
  record_id: string | null;

  old_data: Record<
    string,
    unknown
  > | null;

  new_data: Record<
    string,
    unknown
  > | null;

  created_at: string;
};

export default function AuditLogTable({
  logs,
}: {
  logs: AuditLog[];
}) {
  const [search, setSearch] =
    useState("");

  const [actionFilter, setActionFilter] =
    useState("all");

  const [tableFilter, setTableFilter] =
    useState("all");

  const [actorFilter, setActorFilter] =
    useState("all");

  const [expandedId, setExpandedId] =
    useState<string | null>(null);

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(50);

  const tableNames = useMemo(
    () =>
      Array.from(
        new Set(
          logs.map(
            (log) => log.table_name
          )
        )
      ),
    [logs]
  );

  const actors = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    for (const log of logs) {
      if (!log.actor_id) continue;

      const label =
        log.actor_name ||
        log.actor_email ||
        log.actor_id;

      map.set(
        log.actor_id,
        label
      );
    }

    return Array.from(
      map.entries()
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword =
      search.toLowerCase().trim();

    return logs.filter((log) => {
      const actionMatch =
        actionFilter === "all" ||
        log.action === actionFilter;

      const tableMatch =
        tableFilter === "all" ||
        log.table_name ===
          tableFilter;

      const actorMatch =
        actorFilter === "all" ||
        log.actor_id === actorFilter;

      if (
        !actionMatch ||
        !tableMatch ||
        !actorMatch
      ) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const summary =
        getLogSummary(log)
          .toLowerCase();

      const actor =
        (
          log.actor_name ||
          log.actor_email ||
          ""
        ).toLowerCase();

      const jsonText =
        JSON.stringify({
          old_data:
            log.old_data,
          new_data:
            log.new_data,
        }).toLowerCase();

      return (
        summary.includes(keyword) ||
        actor.includes(keyword) ||
        log.table_name
          .toLowerCase()
          .includes(keyword) ||
        jsonText.includes(keyword)
      );
    });
  }, [
    logs,
    search,
    actionFilter,
    tableFilter,
    actorFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / pageSize)
  );

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [
    search,
    actionFilter,
    tableFilter,
    actorFilter,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;

    return filteredLogs.slice(
      start,
      start + pageSize
    );
  }, [filteredLogs, page, pageSize]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border-2 border-slate-400 bg-white p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_220px_160px]">
          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="사용자, 인플루언서, 캠페인, 변경값 검색"
            className="rounded-lg border border-slate-400 px-4 py-2.5 text-sm"
          />

          <select
            value={actionFilter}
            onChange={(e) =>
              setActionFilter(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">
              전체 작업
            </option>
            <option value="INSERT">
              생성
            </option>
            <option value="UPDATE">
              수정
            </option>
            <option value="DELETE">
              삭제
            </option>
          </select>

          <select
            value={tableFilter}
            onChange={(e) =>
              setTableFilter(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">
              전체 데이터
            </option>

            {tableNames.map(
              (tableName) => (
                <option
                  key={tableName}
                  value={tableName}
                >
                  {getTableLabel(
                    tableName
                  )}
                </option>
              )
            )}
          </select>

          <select
            value={actorFilter}
            onChange={(e) =>
              setActorFilter(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">
              전체 사용자
            </option>

            {actors.map(
              ([id, label]) => (
                <option
                  key={id}
                  value={id}
                >
                  {label}
                </option>
              )
            )}
          </select>

          <select
            value={pageSize}
            onChange={(e) =>
              setPageSize(
                Number(e.target.value)
              )
            }
            className="rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm"
            aria-label="페이지당 활동 로그 수"
          >
            <option value={25}>
              25개씩 보기
            </option>
            <option value={50}>
              50개씩 보기
            </option>
            <option value={100}>
              100개씩 보기
            </option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border-2 border-slate-400 bg-white">
        <div className="border-b border-slate-400 px-6 py-4">
          <p className="text-sm text-slate-500">
            총{" "}
            {filteredLogs.length.toLocaleString()}
            개 기록
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b-2 border-slate-500 bg-slate-100">
              <tr>
                <th className="px-5 py-4 text-left">
                  시간
                </th>

                <th className="px-5 py-4 text-left">
                  사용자
                </th>

                <th className="px-5 py-4 text-left">
                  작업
                </th>

                <th className="px-5 py-4 text-left">
                  대상
                </th>

                <th className="px-5 py-4 text-left">
                  내용
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300">
              {paginatedLogs.map(
                (log) => {
                  const expanded =
                    expandedId ===
                    log.id;

                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() =>
                            setExpandedId(expanded
                              ? null
                              : log.id
                            )
                        }
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {formatDateTime(
                            log.created_at
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium">
                            {log.actor_name ||
                              log.actor_email ||
                              "System"}
                          </div>

                          {log.actor_name &&
                            log.actor_email && (
                              <div className="mt-1 text-xs text-slate-500">
                                {
                                  log.actor_email
                                }
                              </div>
                            )}
                        </td>

                        <td className="px-5 py-4">
                          <ActionBadge
                            action={
                              log.action
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          {getTableLabel(
                            log.table_name
                          )}
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {getLogSummary(
                            log
                          )}
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td
                            colSpan={5}
                            className="bg-slate-50 px-6 py-5"
                          >
                            <LogDetail
                              log={log}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }
              )}

              {filteredLogs.length ===
                0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-16 text-center text-slate-400"
                  >
                    조건에 맞는 활동 로그가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {(
                (page - 1) * pageSize + 1
              ).toLocaleString()}
              -
              {Math.min(
                page * pageSize,
                filteredLogs.length
              ).toLocaleString()}
              개 / 총{" "}
              {filteredLogs.length.toLocaleString()}개
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPage((prev) =>
                    Math.max(1, prev - 1)
                  );
                  setExpandedId(null);
                }}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>

              <span className="min-w-[90px] text-center text-sm text-slate-600">
                {page.toLocaleString()} /{" "}
                {totalPages.toLocaleString()}
              </span>

              <button
                type="button"
                onClick={() => {
                  setPage((prev) =>
                    Math.min(
                      totalPages,
                      prev + 1
                    )
                  );
                  setExpandedId(null);
                }}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ActionBadge({
  action,
}: {
  action:
    | "INSERT"
    | "UPDATE"
    | "DELETE";
}) {
  const label = {
    INSERT: "생성",
    UPDATE: "수정",
    DELETE: "삭제",
  }[action];

  return (
    <span className="inline-flex rounded-full border border-slate-400 bg-slate-100 px-3 py-1 text-xs font-semibold">
      {label}
    </span>
  );
}

function LogDetail({
  log,
}: {
  log: AuditLog;
}) {
  if (
    log.action === "UPDATE"
  ) {
    const changes =
      getChanges(
        log.old_data,
        log.new_data
      );

    return (
      <div>
        <h3 className="mb-3 font-semibold">
          변경 내용
        </h3>

        {changes.length === 0 ? (
          <p className="text-sm text-slate-500">
            표시할 변경값이 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <table className="w-full text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left">
                    항목
                  </th>
                  <th className="px-4 py-3 text-left">
                    변경 전
                  </th>
                  <th className="px-4 py-3 text-left">
                    변경 후
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {changes.map(
                  (change) => (
                    <tr
                      key={
                        change.key
                      }
                    >
                      <td className="px-4 py-3 font-medium">
                        {change.key}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {formatValue(
                          change.before
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-900">
                        {formatValue(
                          change.after
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const data =
    log.action === "INSERT"
      ? log.new_data
      : log.old_data;

  return (
    <div>
      <h3 className="mb-3 font-semibold">
        {log.action ===
        "INSERT"
          ? "생성 데이터"
          : "삭제 데이터"}
      </h3>

      <pre className="max-h-[350px] overflow-auto rounded-lg border border-slate-300 bg-white p-4 text-xs">
        {JSON.stringify(
          data,
          null,
          2
        )}
      </pre>
    </div>
  );
}

function getChanges(
  oldData: Record<
    string,
    unknown
  > | null,
  newData: Record<
    string,
    unknown
  > | null
) {
  if (!oldData || !newData) {
    return [];
  }

  const ignoredFields =
    new Set([
      "updated_at",
    ]);

  const keys = Array.from(
    new Set([
      ...Object.keys(
        oldData
      ),
      ...Object.keys(
        newData
      ),
    ])
  );

  return keys
    .filter(
      (key) =>
        !ignoredFields.has(
          key
        )
    )
    .filter(
      (key) =>
        JSON.stringify(
          oldData[key]
        ) !==
        JSON.stringify(
          newData[key]
        )
    )
    .map((key) => ({
      key,
      before:
        oldData[key],
      after:
        newData[key],
    }));
}

function getLogSummary(
  log: AuditLog
) {
  const data =
    log.new_data ??
    log.old_data ??
    {};

  if (
    log.table_name ===
    "influencers"
  ) {
    const name =
      data.name ||
      data.instagram_id ||
      "인플루언서";

    if (
      log.action === "INSERT"
    ) {
      return `${name} 인플루언서 생성`;
    }

    if (
      log.action === "DELETE"
    ) {
      return `${name} 인플루언서 삭제`;
    }

    return `${name} 인플루언서 수정`;
  }

  if (
    log.table_name ===
    "campaigns"
  ) {
    const name =
      data.name ||
      "캠페인";

    if (
      log.action === "INSERT"
    ) {
      return `${name} 캠페인 생성`;
    }

    if (
      log.action === "DELETE"
    ) {
      return `${name} 캠페인 삭제`;
    }

    return `${name} 캠페인 수정`;
  }

  if (
    log.table_name ===
    "campaign_influencers"
  ) {
    if (
      log.action === "INSERT"
    ) {
      return "캠페인에 인플루언서 추가";
    }

    if (
      log.action === "DELETE"
    ) {
      return "캠페인에서 인플루언서 제거";
    }

    return "캠페인 인플루언서 정보 수정";
  }

  return `${getTableLabel(
    log.table_name
  )} ${getActionLabel(
    log.action
  )}`;
}

function getActionLabel(
  action: string
) {
  if (action === "INSERT")
    return "생성";

  if (action === "UPDATE")
    return "수정";

  if (action === "DELETE")
    return "삭제";

  return action;
}

function getTableLabel(
  tableName: string
) {
  const labels: Record<
    string,
    string
  > = {
    influencers:
      "인플루언서",
    campaigns:
      "캠페인",
    campaign_influencers:
      "캠페인 인플루언서",
    collaboration_history:
      "협업 이력",
    influencer_notes:
      "인플루언서 메모",
  };

  return (
    labels[tableName] ||
    tableName
  );
}

function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "ko-KR"
  );
}

function formatValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  if (
    typeof value ===
    "object"
  ) {
    return JSON.stringify(
      value
    );
  }

  return String(value);
}