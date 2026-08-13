import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// US-007 — the tenant email-log page. Two layers under test:
//   1. the pure query parser (filters, date-range semantics, caps),
//   2. the route: permission gate, tenant scoping, the shape handed to Prisma.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
// The real auth wrapper, permission gate and query parser all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  email_logs: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import {
  buildEmailLogWhere,
  EMAIL_LOG_DEFAULT_PAGE_SIZE,
  EMAIL_LOG_LIST_SELECT,
  EMAIL_LOG_MAX_PAGE,
  EMAIL_LOG_MAX_PAGE_SIZE,
  EMAIL_LOG_MAX_SEARCH_LENGTH,
  parseEmailLogQuery,
} from "@/lib/email/email-log-query";
import {
  buildEmailLogUrl,
  localDayBoundary,
  type EmailLogQueryState,
} from "@/components/admin/email/email-log-url";
import { ALL_FALSE } from "@/lib/permissions/permission-keys";
import { GET as listEmailLogs } from "@/app/api/tenant-admin/email-logs/route";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

function parse(query: string) {
  return parseEmailLogQuery(new URLSearchParams(query));
}

/** Parse and assert success, returning the parsed data. */
function parsed(query: string) {
  const result = parse(query);
  if (!result.success) throw new Error(`expected success: ${result.error.message}`);
  return result.data;
}

const callRoute = (query = "") =>
  listEmailLogs(
    new NextRequest(`http://store.dev/api/tenant-admin/email-logs?${query}`),
  );

const sampleRow = {
  id: "log-1",
  recipient: "patient@example.com",
  subject: "Your order shipped",
  templateName: "orderShipped",
  status: "SENT" as const,
  smtpResponse: "250 2.0.0 OK",
  errorMessage: null,
  sentAt: new Date("2026-08-10T10:00:00.000Z"),
  createdAt: new Date("2026-08-10T09:59:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    teamRole: "manager",
    permissions: { ...ALL_FALSE, canViewEmails: true },
  });
  prismaMock.email_logs.findMany.mockResolvedValue([sampleRow]);
  prismaMock.email_logs.count.mockResolvedValue(1);
});

describe("parseEmailLogQuery — defaults and absent filters", () => {
  it("defaults to page 1 at the default page size with no filters", () => {
    expect(parsed("")).toEqual({ page: 1, limit: EMAIL_LOG_DEFAULT_PAGE_SIZE });
  });

  it("treats an empty param as absent, not as an empty value", () => {
    // The UI clears a filter by submitting `?status=` — that must not become
    // `status: ""` and 400 the whole request.
    expect(parsed("status=&search=&from=&to=&page=")).toEqual({
      page: 1,
      limit: EMAIL_LOG_DEFAULT_PAGE_SIZE,
    });
  });

  it("trims a whitespace-only search to absent", () => {
    expect(parsed("search=%20%20").search).toBeUndefined();
  });

  it("trims surrounding whitespace off a real search term", () => {
    expect(parsed("search=%20me%40x.dev%20").search).toBe("me@x.dev");
  });
});

describe("parseEmailLogQuery — pagination caps", () => {
  it("accepts a valid page and limit", () => {
    expect(parsed("page=3&limit=10")).toMatchObject({ page: 3, limit: 10 });
  });

  it("rejects a limit past the page-size cap rather than silently clamping", () => {
    expect(parse(`limit=${EMAIL_LOG_MAX_PAGE_SIZE + 1}`).success).toBe(false);
    expect(parse("limit=1000000").success).toBe(false);
  });

  it("rejects an unbounded page — deep skip is O(offset) in Postgres", () => {
    expect(parse(`page=${EMAIL_LOG_MAX_PAGE}`).success).toBe(true);
    expect(parse(`page=${EMAIL_LOG_MAX_PAGE + 1}`).success).toBe(false);
  });

  it("rejects non-positive, fractional and non-numeric pagination", () => {
    for (const q of ["page=0", "page=-1", "page=1.5", "page=abc", "limit=0", "limit=x"]) {
      expect(parse(q).success, q).toBe(false);
    }
  });
});

describe("parseEmailLogQuery — status filter", () => {
  it("accepts each EmailStatus value", () => {
    expect(parsed("status=QUEUED").status).toBe("QUEUED");
    expect(parsed("status=SENT").status).toBe("SENT");
    expect(parsed("status=FAILED").status).toBe("FAILED");
  });

  it("rejects an unknown status instead of ignoring it", () => {
    expect(parse("status=BOGUS").success).toBe(false);
    expect(parse("status=sent").success).toBe(false);
  });
});

describe("parseEmailLogQuery — date range", () => {
  it("expands a date-only `to` to the END of that day in UTC", () => {
    // Without this, `to=2026-08-10` would resolve to midnight and silently
    // exclude every message sent that day.
    expect(parsed("to=2026-08-10").to?.toISOString()).toBe("2026-08-10T23:59:59.999Z");
  });

  it("anchors a date-only `from` to the START of that day in UTC", () => {
    expect(parsed("from=2026-08-10").from?.toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
  });

  it("passes a full ISO timestamp through untouched", () => {
    expect(parsed("from=2026-08-10T14:30:00.000Z").from?.toISOString()).toBe(
      "2026-08-10T14:30:00.000Z",
    );
  });

  it("rejects an unparseable date", () => {
    for (const q of ["from=yesterday", "to=2026-13-45", "from=2026-08-99"]) {
      expect(parse(q).success, q).toBe(false);
    }
  });

  it("rejects an inverted range", () => {
    expect(parse("from=2026-08-10&to=2026-08-01").success).toBe(false);
  });

  it("accepts a single-day range (same from and to)", () => {
    const range = parsed("from=2026-08-10&to=2026-08-10");
    expect(range.from!.getTime()).toBeLessThan(range.to!.getTime());
  });
});

describe("parseEmailLogQuery — search bounds", () => {
  it("accepts a term at the maximum address length", () => {
    expect(parse(`search=${"a".repeat(EMAIL_LOG_MAX_SEARCH_LENGTH)}`).success).toBe(true);
  });

  it("rejects a term longer than any address can be", () => {
    expect(parse(`search=${"a".repeat(EMAIL_LOG_MAX_SEARCH_LENGTH + 1)}`).success).toBe(
      false,
    );
  });
});

describe("buildEmailLogWhere", () => {
  it("always scopes to the supplied tenant", () => {
    expect(buildEmailLogWhere(TENANT_A, parsed(""))).toEqual({ tenantId: TENANT_A });
  });

  it("cannot be redirected at another tenant from the query string", () => {
    // `tenantId` is not part of the schema, so it never reaches the filter.
    const where = buildEmailLogWhere(TENANT_A, parsed(`tenantId=${TENANT_B}`));
    expect(where.tenantId).toBe(TENANT_A);
    expect(JSON.stringify(where)).not.toContain(TENANT_B);
  });

  it("adds status, range and a case-insensitive recipient match", () => {
    const where = buildEmailLogWhere(
      TENANT_A,
      parsed("status=FAILED&from=2026-08-01&to=2026-08-10&search=Patient%40Example.com"),
    );
    expect(where).toEqual({
      tenantId: TENANT_A,
      status: "FAILED",
      createdAt: {
        gte: new Date("2026-08-01T00:00:00.000Z"),
        lte: new Date("2026-08-10T23:59:59.999Z"),
      },
      recipient: { contains: "Patient@Example.com", mode: "insensitive" },
    });
  });

  it("emits an open-ended range when only one bound is given", () => {
    expect(buildEmailLogWhere(TENANT_A, parsed("from=2026-08-01")).createdAt).toEqual({
      gte: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(buildEmailLogWhere(TENANT_A, parsed("to=2026-08-01")).createdAt).toEqual({
      lte: new Date("2026-08-01T23:59:59.999Z"),
    });
  });
});

describe("buildEmailLogUrl — what the Activity tab actually requests", () => {
  const state: EmailLogQueryState = {
    page: 1,
    limit: 25,
    status: "",
    from: "",
    to: "",
    search: "",
  };

  const paramsOf = (over: Partial<EmailLogQueryState> = {}) =>
    new URL(buildEmailLogUrl({ ...state, ...over }), "http://store.dev").searchParams;

  it("always sends page and limit, and omits every unset filter", () => {
    const params = paramsOf();
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("25");
    expect(params.has("status")).toBe(false);
    expect(params.has("from")).toBe(false);
    expect(params.has("to")).toBe(false);
    expect(params.has("search")).toBe(false);
  });

  it("passes the search term through untrimmed — the API owns trimming", () => {
    // Trimming here would fight SearchInput's controlled value and eat the
    // space the admin just typed.
    expect(paramsOf({ search: "me@x.dev " }).get("search")).toBe("me@x.dev ");
  });

  it("sends the admin's LOCAL day boundaries, not UTC's", () => {
    // A bare YYYY-MM-DD means "my today" to whoever picked it. Asserted as a
    // property rather than a literal so the test holds in any TZ.
    const from = new Date(paramsOf({ from: "2026-08-10" }).get("from")!);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(7);
    expect(from.getDate()).toBe(10);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
  });

  it("stretches `to` to the last instant of that local day", () => {
    const to = new Date(paramsOf({ to: "2026-08-10" }).get("to")!);
    expect(to.getDate()).toBe(10);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
    expect(to.getSeconds()).toBe(59);
  });

  it("covers the whole day, one millisecond short of the next", () => {
    const from = new Date(localDayBoundary("2026-08-10", false)).getTime();
    const to = new Date(localDayBoundary("2026-08-10", true)).getTime();
    expect(to - from).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it("passes an unparseable date straight through for the API to reject", () => {
    // Throwing here would take the whole tab down; a 400 is recoverable.
    expect(localDayBoundary("", false)).toBe("");
    expect(localDayBoundary("not-a-date", true)).toBe("not-a-date");
  });
});

describe("GET /api/tenant-admin/email-logs", () => {
  it("returns the page plus pagination metadata", async () => {
    prismaMock.email_logs.count.mockResolvedValue(60);
    const res = await callRoute("page=2&limit=25");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 2, limit: 25, total: 60, totalPages: 3 });
  });

  it("scopes the query to the caller's tenant and orders newest first", async () => {
    await callRoute();
    const args = prismaMock.email_logs.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: TENANT_A });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.skip).toBe(0);
    expect(args.take).toBe(EMAIL_LOG_DEFAULT_PAGE_SIZE);
  });

  it("ignores a tenantId supplied by the caller", async () => {
    await callRoute(`tenantId=${TENANT_B}`);
    const args = prismaMock.email_logs.findMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe(TENANT_A);
  });

  it("counts with the SAME filter it lists with", async () => {
    // A count built from a different filter reports page numbers that don't
    // exist, which reads as data loss to the admin.
    await callRoute("status=FAILED&search=a%40b.dev");
    const listArgs = prismaMock.email_logs.findMany.mock.calls[0][0];
    const countArgs = prismaMock.email_logs.count.mock.calls[0][0];
    expect(countArgs.where).toEqual(listArgs.where);
  });

  it("translates page/limit into the right offset", async () => {
    await callRoute("page=4&limit=10");
    const args = prismaMock.email_logs.findMany.mock.calls[0][0];
    expect(args.skip).toBe(30);
    expect(args.take).toBe(10);
  });

  it("never selects the metadata column", async () => {
    await callRoute();
    const { select } = prismaMock.email_logs.findMany.mock.calls[0][0];
    expect(select).toEqual(EMAIL_LOG_LIST_SELECT);
    expect(select).not.toHaveProperty("metadata");
    expect(select).not.toHaveProperty("tenantId");
  });

  it("surfaces smtpResponse and errorMessage for the detail drawer", async () => {
    const res = await callRoute();
    const [log] = (await res.json()).logs;
    expect(log.smtpResponse).toBe("250 2.0.0 OK");
    expect(log).toHaveProperty("errorMessage");
    expect(log).not.toHaveProperty("metadata");
  });

  it("400s an invalid filter without touching the database", async () => {
    const res = await callRoute("status=BOGUS");
    expect(res.status).toBe(400);
    expect(prismaMock.email_logs.findMany).not.toHaveBeenCalled();
  });

  it("403s a caller without canViewEmails", async () => {
    resolveUserPermissions.mockResolvedValue({
      teamRole: "packer",
      permissions: { ...ALL_FALSE, canViewEmails: false },
    });
    const res = await callRoute();
    expect(res.status).toBe(403);
    expect(prismaMock.email_logs.findMany).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await callRoute()).status).toBe(401);
  });

  it("401s a customer-role caller", async () => {
    getCurrentUser.mockResolvedValue(adminUser({ role: "PATIENT" }));
    expect((await callRoute()).status).toBe(401);
  });

  it("500s without leaking the database error", async () => {
    prismaMock.email_logs.findMany.mockRejectedValue(new Error("relation missing"));
    const res = await callRoute();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).not.toContain("relation missing");
  });
});
