import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  SEO_REDIRECT_FEED_MAX_REQUESTS,
  SEO_REDIRECT_FEED_TIMEOUT_MS,
  SEO_REDIRECT_FEED_WINDOW_MS,
} from "@/lib/constants";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { PLATFORM_REDIRECT_SCOPE } from "@/lib/seo/redirect-lookup";
import {
  SEO_REDIRECT_MAX_PER_TENANT,
  type SeoRedirectRule,
} from "@/lib/seo/redirects";
import { withinPublicRateLimit } from "@/lib/security/abandonable-rate-limit";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import { resolveTenant } from "@/lib/tenant/tenant-resolver";

/**
 * SEO Supercharge US-020 — the redirect table, in the one form middleware can
 * read it.
 *
 * WHY A ROUTE AND NOT A QUERY. Next 14 middleware runs in the edge runtime:
 * no Prisma, no socket, no database. `lib/seo/redirect-lookup.ts` therefore
 * keeps a per-host table in memory and refreshes it from HERE, where the Node
 * runtime and the real client are available. That module's docstring carries the
 * cost model; the short version is that a warm middleware never calls this at
 * all, and a tenant with no redirects gets an empty array cached for ten
 * minutes.
 *
 * PUBLIC, and registered as such in both gates (`isPublicRoute` in
 * middleware.ts, AUTH_PUBLIC_ROUTES in lib/auth-public-routes.ts). The caller is
 * our own middleware, which has no session and cannot obtain one: it runs BEFORE
 * auth on every request, including a crawler's. What keeps that acceptable:
 *   - the answer is a list of paths that already redirect in public. Anyone can
 *     discover the same rules by requesting them; there is nothing here a
 *     visitor could not observe from the outside;
 *   - the tenant is resolved from the SUPPLIED HOST through the canonical
 *     resolver, exactly as the storefront resolves it, and the rows returned are
 *     read inside that tenant's context — so a crafted host can only ever return
 *     the redirects that host would really follow;
 *   - IP rate-limited, because it is an unauthenticated endpoint that costs a
 *     query.
 *
 * WHY THE HOST IS A QUERY PARAMETER and not the Host header, which is the
 * convention everywhere else on the storefront: behind Cloudflare for SaaS the
 * real tenant host arrives in `x-original-host` and is only trusted when paired
 * with `CF_PROXY_SECRET` (middleware.ts `resolveTenantHost`). Middleware
 * deliberately strips that secret before anything downstream sees it, so a
 * loopback fetch cannot replay the pair; and setting a Host header on a `fetch`
 * is forbidden by the Fetch spec. Passing the host explicitly is the honest
 * version of what the header would have said. It does not widen anything: the
 * response is public either way, and the tenant still comes from a host rather
 * than from a tenant id the caller chose.
 *
 * PLAN GATE. `seo.pro` only. A Basic tenant's stored rules go DORMANT — they
 * stay in the table, they stay visible in the manager, and they stop firing —
 * so a downgrade never silently deletes an owner's work and an upgrade brings it
 * straight back. Same 200-with-empty-array as an unknown host, so the endpoint
 * cannot be used to enumerate which stores are on which plan.
 *
 * TWO TABLES, ONE FEED (Platform US-019). `?scope=platform` answers from
 * `platform_seo_redirects` — budstacks.io's own 301s, which belong to no tenant
 * and are gated by no plan. Neither the host resolution nor the plan gate above
 * applies to it, because neither has anything to answer: the platform is not a
 * customer of itself. Everything else is shared, which is the point — one
 * cache, one matcher, one refusal path.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "GET /api/public/seo/redirects";

/** Counter namespace, so this route never shares a bucket with another. */
const RATE_LIMIT_SCOPE = "seo-redirect-feed";

const querySchema = z.object({
  /** A Host header value; the resolver strips any port itself. */
  host: z.string().min(1).max(255),
  /**
   * The incoming pathname. Only read for local dev's `/store/{slug}` routing,
   * where the host says nothing about the tenant. Ignored on a tenant host.
   */
  path: z.string().max(2048).optional(),
  /**
   * Which table answers (Platform US-019). Absent — every caller before this
   * story — is the tenant table, unchanged.
   */
  scope: z.literal(PLATFORM_REDIRECT_SCOPE).optional(),
});

/** Both "no such store" and "not on Pro" answer this. */
const NO_REDIRECTS = { redirects: [] as SeoRedirectRule[] };

function feedResponse(redirects: SeoRedirectRule[]): NextResponse {
  return NextResponse.json(
    { redirects },
    {
      // The middleware cache is the only cache that should exist here: it has
      // the per-tenant TTL and the stale-while-revalidate behaviour. A shared
      // HTTP cache in front would add a second, unrelated staleness window on
      // top of it and make a redirect's arrival time unpredictable.
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (
      !(await withinPublicRateLimit({
        scope: RATE_LIMIT_SCOPE,
        headers: request.headers,
        maxRequests: SEO_REDIRECT_FEED_MAX_REQUESTS,
        windowMs: SEO_REDIRECT_FEED_WINDOW_MS,
        timeoutMs: SEO_REDIRECT_FEED_TIMEOUT_MS,
      }))
    ) {
      return new NextResponse(null, {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(SEO_REDIRECT_FEED_WINDOW_MS / 1000)),
        },
      });
    }

    const parsed = querySchema.safeParse({
      host: request.nextUrl.searchParams.get("host") ?? undefined,
      path: request.nextUrl.searchParams.get("path") ?? undefined,
      scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    });
    if (!parsed.success) return feedResponse(NO_REDIRECTS.redirects);

    // Platform US-019 — budstacks.io's OWN redirects, which belong to no
    // tenant. No host resolution and no plan gate: there is no tenant to
    // resolve and the platform is not a customer of itself. `scope` decides
    // this and the host does not, because on the apex the host says only "not a
    // store" — the same thing an unknown host says.
    //
    // Not a widening: the answer is a list of paths that already 301 in public
    // on this origin, discoverable by requesting any of them. The rate limit
    // above has already been charged.
    if (parsed.data.scope === PLATFORM_REDIRECT_SCOPE) {
      const rows: Array<{
        fromPath: string;
        toPath: string;
        statusCode: number;
      }> = await prisma.platform_seo_redirects.findMany({
        select: { fromPath: true, toPath: true, statusCode: true },
        orderBy: { createdAt: "asc" },
        take: SEO_REDIRECT_MAX_PER_TENANT,
      });

      return feedResponse(rows);
    }

    const resolved = await resolveTenant({
      kind: "host",
      host: parsed.data.host,
      pathname: parsed.data.path ?? "/",
    });
    if (!resolved) return feedResponse(NO_REDIRECTS.redirects);

    if (
      !isSeoProUnlocked({
        id: resolved.tenantId,
        plan: resolved.tenant.plan,
      })
    ) {
      return feedResponse(NO_REDIRECTS.redirects);
    }

    // `seo_redirects` is in `tenantScopedModels` (lib/db.ts), so the read runs
    // inside an explicit context: the extension re-applies the tenantId on top
    // of the one in the `where`, and an unbound read would be a scope-policy
    // violation rather than a silent full-table scan.
    const rows: Array<{
      fromPath: string;
      toPath: string;
      statusCode: number;
    }> = await runWithTenantContextAsync(resolved.tenantId, () =>
      prisma.seo_redirects.findMany({
        where: { tenantId: resolved.tenantId },
        select: { fromPath: true, toPath: true, statusCode: true },
        orderBy: { createdAt: "asc" },
        // Belt to the write-time cap's braces. If the two ever disagree the
        // owner sees the refusal in the manager, not a rule that quietly does
        // nothing on the site.
        take: SEO_REDIRECT_MAX_PER_TENANT,
      }),
    );

    return feedResponse(rows);
  } catch (error) {
    // A failure here must not stall the storefront request waiting behind it.
    // The lookup treats any non-200 as "no redirects" and retries shortly.
    return apiError(error, {
      route: ROUTE,
      safeMessage: "Redirects unavailable",
    });
  }
}
