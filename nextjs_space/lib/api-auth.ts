import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";

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

      return await handler(req, { user, tenantId });
    } catch (error) {
      console.error(`[${req.method} ${req.nextUrl.pathname}] Error:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
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

      return await handler(req, { user, tenantId }, params);
    } catch (error) {
      console.error(`[${req.method} ${req.nextUrl.pathname}] Error:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
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

      return await handler(req, { user });
    } catch (error) {
      console.error(`[${req.method} ${req.nextUrl.pathname}] Error:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Wraps a route handler with basic authentication (any logged-in user).
 */
export function withAuth(handler: RouteHandler<AuthContext>) {
  return async (req: NextRequest) => {
    try {
      const user = await getCurrentUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return await handler(req, { user });
    } catch (error) {
      console.error(`[${req.method} ${req.nextUrl.pathname}] Error:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
