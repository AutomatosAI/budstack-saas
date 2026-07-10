import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { apiError } from "@/lib/api-error";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";
import {
  runWithImpersonationContextAsync,
  type ImpersonationAuditContext,
} from "@/lib/impersonation/context";

/**
 * PRD-302 AC-5: when the authenticated caller is an impersonating super-admin,
 * bind the impersonation audit context around the handler so createAuditLog
 * stamps impersonationSessionId on every row written inside the request.
 * Bound by EVERY wrapper below (not just the tenant ones) so the stamp is
 * wrapper-independent — legacy withAuth routes (e.g. customer mutations) and
 * super-admin console actions taken mid-session are all captured in the trail.
 * Null (the overwhelmingly common case) makes the wrapper a pure passthrough.
 */
function impersonationCtxOf(user: AuthUser): ImpersonationAuditContext | null {
  if (!user.impersonation) return null;
  return {
    sessionId: user.impersonation.sessionId,
    superAdminClerkId: user.impersonation.superAdminClerkId,
    superAdminEmail: user.impersonation.superAdminEmail,
  };
}

/**
 * Authenticated user shape returned by getCurrentUser()
 */
type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Context passed to authenticated route handlers.
 */
export interface TenantAuthContext {
  user: AuthUser;
  tenantId: string;
}

export interface SuperAdminAuthContext {
  user: AuthUser;
}

export interface AuthContext {
  user: AuthUser;
}

type RouteHandler<T> = (req: NextRequest, ctx: T) => Promise<NextResponse>;
type RouteHandlerWithParams<T> = (
  req: NextRequest,
  ctx: T,
  params: Record<string, string>,
) => Promise<NextResponse>;

/**
 * Wraps a route handler with tenant admin authentication.
 * Validates: user exists, role is TENANT_ADMIN or SUPER_ADMIN, tenantId is present.
 *
 * Usage:
 * ```ts
 * export const GET = withTenantAuth(async (req, { user, tenantId }) => {
 *   // user and tenantId are guaranteed to exist
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withTenantAuth(handler: RouteHandler<TenantAuthContext>) {
  return async (req: NextRequest) => {
    try {
      const user = await getCurrentUser();

      if (
        !user ||
        (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN")
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tenantId = user.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: "No tenant associated with user" },
          { status: 403 },
        );
      }

      return await runWithTenantContextAsync(tenantId, () =>
        runWithImpersonationContextAsync(impersonationCtxOf(user), () =>
          handler(req, { user, tenantId }),
        ),
      );
    } catch (error) {
      return apiError(error, { route: `${req.method} ${req.nextUrl.pathname}` });
    }
  };
}

/**
 * Wraps a route handler with tenant admin auth + route params.
 * For routes like /api/tenant-admin/products/[id]/route.ts
 */
export function withTenantAuthParams(
  handler: RouteHandlerWithParams<TenantAuthContext>,
) {
  return async (
    req: NextRequest,
    { params }: { params: Record<string, string> },
  ) => {
    try {
      const user = await getCurrentUser();

      if (
        !user ||
        (user.role !== "TENANT_ADMIN" && user.role !== "SUPER_ADMIN")
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tenantId = user.tenantId;
      if (!tenantId) {
        return NextResponse.json(
          { error: "No tenant associated with user" },
          { status: 403 },
        );
      }

      return await runWithTenantContextAsync(tenantId, () =>
        runWithImpersonationContextAsync(impersonationCtxOf(user), () =>
          handler(req, { user, tenantId }, params),
        ),
      );
    } catch (error) {
      return apiError(error, { route: `${req.method} ${req.nextUrl.pathname}` });
    }
  };
}

/**
 * Wraps a route handler with super admin authentication.
 *
 * Usage:
 * ```ts
 * export const GET = withSuperAdmin(async (req, { user }) => {
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withSuperAdmin(handler: RouteHandler<SuperAdminAuthContext>) {
  return async (req: NextRequest) => {
    try {
      const user = await getCurrentUser();

      if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return await runWithTenantContextAsync(null, () =>
        runWithImpersonationContextAsync(impersonationCtxOf(user), () =>
          handler(req, { user }),
        ),
      );
    } catch (error) {
      return apiError(error, { route: `${req.method} ${req.nextUrl.pathname}` });
    }
  };
}

/**
 * Wraps a route handler with super admin auth + route params.
 * For routes like /api/super-admin/tenants/[id]/route.ts
 */
export function withSuperAdminParams(
  handler: RouteHandlerWithParams<SuperAdminAuthContext>,
) {
  return async (
    req: NextRequest,
    { params }: { params: Record<string, string> },
  ) => {
    try {
      const user = await getCurrentUser();

      if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return await runWithTenantContextAsync(null, () =>
        runWithImpersonationContextAsync(impersonationCtxOf(user), () =>
          handler(req, { user }, params),
        ),
      );
    } catch (error) {
      return apiError(error, { route: `${req.method} ${req.nextUrl.pathname}` });
    }
  };
}

/**
 * Wraps a route handler with basic authentication (any logged-in user) and binds
 * the HOST tenant around the handler.
 *
 * Unlike withTenantAuth (which binds the user's own tenant for admin routes),
 * withAuth binds the tenant resolved from the request host — the storefront the
 * caller is on. That is what scopes routes like customer/profile to the right
 * tenant. A null host resolution is bound explicitly, so the Prisma middleware
 * sees a deliberate non-tenant query, not the implicit-unbound leak.
 *
 * Forwards the Next.js route context's `params` as the handler's 3rd arg, so
 * param'd any-auth routes (e.g. store/[slug]/**) keep working after migration.
 */
export function withAuth(handler: RouteHandlerWithParams<AuthContext>) {
  return async (
    req: NextRequest,
    routeCtx?: { params: Record<string, string> },
  ) => {
    try {
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const tenant = await getTenantFromRequest(req);
      const params = routeCtx?.params ?? {};
      return await runWithTenantContextAsync(tenant?.id ?? null, () =>
        runWithImpersonationContextAsync(impersonationCtxOf(user), () =>
          handler(req, { user }, params),
        ),
      );
    } catch (error) {
      return apiError(error, { route: `${req.method} ${req.nextUrl.pathname}` });
    }
  };
}
