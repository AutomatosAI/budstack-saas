import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";

const MAX_RESULTS = 10;
const MAX_QUERY_LENGTH = 100;
// Autocomplete fires per (debounced) keystroke — the 20/min default would 429
// a support person mid-search. Still bounded: 60/min per super-admin.
const SEARCH_RATE_LIMIT = { maxRequests: 60, windowMs: 60_000 };

/**
 * GET /api/super-admin/tenants/search?q=herb — PRD-302 AC-6.
 * Lean autocomplete for the "Impersonate Tenant" picker: active, non-deleted
 * tenants matched on business name or subdomain. Deliberately thin compared to
 * GET /api/super-admin/tenants (full paginated rows) — this returns only what
 * the picker renders.
 */
export const GET = withSuperAdmin(async (req, { user }) => {
  try {
    const rateLimitResult = await checkRateLimit(
      `tenant-search:${user.id}`,
      SEARCH_RATE_LIMIT,
    );
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

    if (!q) {
      return NextResponse.json({ tenants: [] });
    }

    const rows = await prisma.tenants.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { businessName: { contains: q, mode: "insensitive" } },
          { subdomain: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        countryCode: true,
        createdAt: true,
      },
      orderBy: { businessName: "asc" },
      take: MAX_RESULTS,
    });

    return NextResponse.json({
      tenants: rows.map(
        (row: {
          id: string;
          businessName: string;
          subdomain: string;
          countryCode: string;
          createdAt: Date;
        }) => ({
          id: row.id,
          businessName: row.businessName,
          subdomain: row.subdomain,
          countryCode: row.countryCode,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
    });
  } catch (error) {
    return apiError(error, { route: `GET ${req.nextUrl.pathname}` });
  }
});
