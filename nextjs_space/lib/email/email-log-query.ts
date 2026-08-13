import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * US-007 — query parsing for GET /api/tenant-admin/email-logs.
 *
 * Kept separate from the route so the filter/pagination rules are unit-testable
 * without an auth wrapper or a database. The route supplies `tenantId`; nothing
 * here reads it from caller input.
 */

/** Mirrors `enum EmailStatus` in prisma/schema.prisma. */
export const EMAIL_LOG_STATUSES = ["QUEUED", "SENT", "FAILED"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export const EMAIL_LOG_DEFAULT_PAGE_SIZE = 25;
export const EMAIL_LOG_MAX_PAGE_SIZE = 100;

/**
 * `skip` is O(offset) in Postgres, so an unbounded `?page=` is a cheap way to
 * make the server do expensive work. 10,000 pages is far past anything a human
 * scrolls to and bounds the worst case.
 */
export const EMAIL_LOG_MAX_PAGE = 10_000;

/** RFC 5321 caps an address at 254 chars — a longer needle can never match. */
export const EMAIL_LOG_MAX_SEARCH_LENGTH = 254;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpret a range boundary. A bare `YYYY-MM-DD` (what `<input type="date">`
 * submits) covers the WHOLE day in UTC — without the end-of-day expansion a
 * `to` of today would silently exclude everything sent today. Full ISO
 * timestamps are passed through untouched.
 */
function parseBoundary(value: string, endOfDay: boolean): Date | null {
  const raw = DATE_ONLY.test(value)
    ? `${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`
    : value;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const boundarySchema = (endOfDay: boolean) =>
  z.string().transform((value, ctx) => {
    const parsed = parseBoundary(value, endOfDay);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected YYYY-MM-DD or an ISO timestamp",
      });
      return z.NEVER;
    }
    return parsed;
  });

export const emailLogQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .max(EMAIL_LOG_MAX_PAGE)
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(EMAIL_LOG_MAX_PAGE_SIZE)
      .default(EMAIL_LOG_DEFAULT_PAGE_SIZE),
    status: z.enum(EMAIL_LOG_STATUSES).optional(),
    from: boundarySchema(false).optional(),
    to: boundarySchema(true).optional(),
    search: z.string().trim().min(1).max(EMAIL_LOG_MAX_SEARCH_LENGTH).optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "'from' must not be after 'to'",
    path: ["from"],
  });

export type EmailLogQuery = z.infer<typeof emailLogQuerySchema>;

/**
 * Read a query param, treating a missing param and an empty one identically.
 * The UI clears a filter by submitting `?status=`, which must mean "unset"
 * rather than "the empty status".
 */
function readParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value === null || value.trim() === "" ? undefined : value;
}

/** Parse the raw search params. Never throws — the route renders the failure. */
export function parseEmailLogQuery(params: URLSearchParams) {
  return emailLogQuerySchema.safeParse({
    page: readParam(params, "page"),
    limit: readParam(params, "limit"),
    status: readParam(params, "status"),
    from: readParam(params, "from"),
    to: readParam(params, "to"),
    search: readParam(params, "search"),
  });
}

/**
 * Build the Prisma filter. `tenantId` is always present and comes from the
 * authenticated session — never from the query string — so a caller cannot
 * widen the filter to another tenant's logs.
 */
export function buildEmailLogWhere(
  tenantId: string,
  query: EmailLogQuery,
): Prisma.email_logsWhereInput {
  const createdAt =
    query.from || query.to
      ? {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        }
      : undefined;

  return {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(query.search
      ? { recipient: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };
}

/** Fields returned to the client. `metadata` is deliberately withheld. */
export const EMAIL_LOG_LIST_SELECT = {
  id: true,
  recipient: true,
  subject: true,
  templateName: true,
  status: true,
  smtpResponse: true,
  errorMessage: true,
  sentAt: true,
  createdAt: true,
} as const;
