/**
 * US-007 — request-key building for the Activity tab. Pure, so the date-range
 * semantics are testable without rendering the component.
 */

export interface EmailLogQueryState {
  page: number;
  limit: number;
  status: string;
  from: string;
  to: string;
  search: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `<input type="date">` yields a bare calendar date, which the admin means in
 * THEIR timezone — not UTC. Widen it to that local day's real instants so
 * "everything sent today" covers their today. The API also accepts the bare
 * date (treating it as a UTC day), so an unparseable value is passed through
 * untouched and rejected server-side with a proper validation message rather
 * than throwing here.
 */
export function localDayBoundary(date: string, endOfDay: boolean): string {
  const parts = DATE_ONLY.exec(date);
  if (!parts) return date;

  const [, year, month, day] = parts;
  const local = endOfDay
    ? new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
    : new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);

  return Number.isNaN(local.getTime()) ? date : local.toISOString();
}

export function buildEmailLogUrl(query: EmailLogQueryState): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", localDayBoundary(query.from, false));
  if (query.to) params.set("to", localDayBoundary(query.to, true));
  if (query.search) params.set("search", query.search);
  return `/api/tenant-admin/email-logs?${params.toString()}`;
}
