"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Loader2, MailX, Search } from "lucide-react";
import {
  EmptyState,
  Pagination,
  RowPill,
  SearchInput,
  StatusFilter,
  type StatusFilterOption,
} from "@/components/admin/shared";
import {
  EMAIL_LOG_DEFAULT_PAGE_SIZE,
  EMAIL_LOG_STATUSES,
} from "@/lib/email/email-log-query";
import { EmailLogDetailDrawer } from "./EmailLogDetailDrawer";
import { buildEmailLogUrl, type EmailLogQueryState } from "./email-log-url";
import {
  EMAIL_LOG_STATUS_LABEL,
  EMAIL_LOG_STATUS_TONE,
  type EmailLogListResponse,
  type EmailLogRow,
} from "./email-log-types";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const COLUMN_COUNT = 5;

const fetcher = async (url: string): Promise<EmailLogListResponse> => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Failed to load email activity");
  }
  return data;
};

/**
 * Everything the request key is built from — page included, so a filter change
 * and the offset reset land in a SINGLE state update. Held apart, the
 * intermediate render would fetch page 7 of the newly-filtered set first.
 */
type Query = EmailLogQueryState;

const INITIAL_QUERY: Query = {
  page: 1,
  limit: EMAIL_LOG_DEFAULT_PAGE_SIZE,
  status: "",
  from: "",
  to: "",
  search: "",
};

const STATUS_OPTIONS: StatusFilterOption[] = [
  { value: "", label: "All statuses" },
  ...EMAIL_LOG_STATUSES.map((status) => ({
    value: status,
    label: EMAIL_LOG_STATUS_LABEL[status],
  })),
];

/**
 * US-007 — the Activity tab: every message this tenant queued, with the
 * failure detail behind a per-row drawer.
 */
export function EmailActivityLog() {
  const [query, setQuery] = useState<Query>(INITIAL_QUERY);
  const [selected, setSelected] = useState<EmailLogRow | null>(null);

  // Any filter or page-size change invalidates the current offset — page 7 of
  // the old result set is usually empty in the new one.
  const updateFilter = (patch: Partial<Query>) =>
    setQuery((prev) => ({ ...prev, ...patch, page: 1 }));

  const url = useMemo(() => buildEmailLogUrl(query), [query]);
  const { data, error, isLoading } = useSWR<EmailLogListResponse>(url, fetcher, {
    keepPreviousData: true,
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const hasFilters = Boolean(query.status || query.from || query.to || query.search);

  // The result set shrinks under a fixed filter as the worker drains the queue
  // (QUEUED rows become SENT/FAILED). Without this the admin is stranded on a
  // page that no longer exists. Keyed off the page the SERVER echoed back, so
  // an in-flight request can't trigger a spurious clamp.
  useEffect(() => {
    if (!pagination) return;
    const lastPage = Math.max(1, pagination.totalPages);
    if (pagination.page > lastPage) {
      setQuery((prev) => ({ ...prev, page: lastPage }));
    }
  }, [pagination]);

  const clearFilters = () => setQuery((prev) => ({ ...INITIAL_QUERY, limit: prev.limit }));

  return (
    <section className="bs-card overflow-hidden">
      <div className="bs-card-pad border-b border-bs-border-100">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2
              className="text-[22px] font-semibold text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Delivery Activity
            </h2>
            <p className="mt-1 text-sm text-bs-fg-muted">
              <span className="font-mono tabular-nums text-bs-fg">{total}</span>{" "}
              {hasFilters ? "messages match these filters" : "messages sent"}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
            <div className="w-full xl:w-64">
              <SearchInput
                value={query.search}
                onChange={(search) => updateFilter({ search })}
                placeholder="Search recipient..."
                aria-label="Search email activity by recipient address"
              />
            </div>
            <StatusFilter
              value={query.status}
              onChange={(status) => updateFilter({ status })}
              options={STATUS_OPTIONS}
              aria-label="Filter by delivery status"
              showIcon={false}
              className="w-full xl:w-[150px]"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={query.from}
                max={query.to || undefined}
                onChange={(e) => updateFilter({ from: e.target.value })}
                className="bs-input w-full xl:w-[150px]"
                aria-label="Queued on or after"
              />
              <span className="text-sm text-bs-fg-muted">to</span>
              <input
                type="date"
                value={query.to}
                min={query.from || undefined}
                onChange={(e) => updateFilter({ to: e.target.value })}
                className="bs-input w-full xl:w-[150px]"
                aria-label="Queued on or before"
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bs-card-pad text-sm text-bs-danger" role="alert">
          {error.message}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="bs-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Recipient</th>
                  <th className="hidden text-left md:table-cell">Subject</th>
                  <th className="hidden text-left lg:table-cell">Template</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Queued</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="p-0">
                      {isLoading ? (
                        <div className="py-12 text-center">
                          <Loader2
                            className="mx-auto h-6 w-6 animate-spin text-bs-fg-muted"
                            aria-label="Loading email activity"
                          />
                        </div>
                      ) : hasFilters ? (
                        <EmptyState
                          icon={Search}
                          heading="No emails match these filters"
                          description="Try widening the date range or clearing the recipient search."
                          variant="muted"
                          action={{
                            label: "Clear filters",
                            onClick: clearFilters,
                            variant: "outline",
                          }}
                          className="my-8"
                        />
                      ) : (
                        <EmptyState
                          icon={MailX}
                          heading="No emails sent yet"
                          description="Messages your store sends will appear here, with the delivery result for each one."
                          className="my-8"
                        />
                      )}
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View delivery detail for ${log.recipient}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(log);
                      }
                    }}
                    className="cursor-pointer hover:bg-bs-card-2"
                  >
                    <td className="max-w-[220px] truncate font-mono text-xs text-bs-fg">
                      {log.recipient}
                    </td>
                    <td className="hidden max-w-[280px] truncate text-bs-fg-muted md:table-cell">
                      {log.subject}
                    </td>
                    <td className="hidden text-bs-fg-muted lg:table-cell">
                      {log.templateName}
                    </td>
                    <td>
                      <RowPill tone={EMAIL_LOG_STATUS_TONE[log.status]}>
                        {EMAIL_LOG_STATUS_LABEL[log.status]}
                      </RowPill>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs tabular-nums text-bs-fg-muted">
                      {format(new Date(log.createdAt), "d MMM, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="border-t border-bs-border-100 bg-bs-card-2">
              <Pagination
                page={query.page}
                pageSize={query.limit}
                totalItems={total}
                onPageChange={(page) => setQuery((prev) => ({ ...prev, page }))}
                onPageSizeChange={(limit) => updateFilter({ limit })}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                showPageSizeSelector
                showFirstLast
              />
            </div>
          )}
        </>
      )}

      <EmailLogDetailDrawer log={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
