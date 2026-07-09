import { NextRequest, NextResponse } from "next/server";
import {
  withTenantAuth,
  withTenantAuthParams,
  type TenantAuthContext,
} from "@/lib/api-auth";
import { resolveUserPermissions } from "./current-user-permissions";
import { can } from "./resolve";
import type { PermissionKey, PermissionSet } from "./permission-keys";

export interface PermissionAuthContext extends TenantAuthContext {
  permissions: PermissionSet;
  teamRole: string | null;
}

const FORBIDDEN = () =>
  NextResponse.json(
    { error: "You do not have permission to do that." },
    { status: 403 },
  );

/**
 * Like `withTenantAuth`, but additionally requires the caller's effective
 * permission set to grant `key`. Denied callers get a 403 before the handler
 * runs. The resolved `permissions`/`teamRole` are added to the handler context.
 */
export function requirePermission(
  key: PermissionKey,
  handler: (req: NextRequest, ctx: PermissionAuthContext) => Promise<NextResponse>,
) {
  return withTenantAuth(async (req, ctx) => {
    const { permissions, teamRole } = await resolveUserPermissions(ctx.user, ctx.tenantId);
    if (!can(permissions, key)) return FORBIDDEN();
    return handler(req, { ...ctx, permissions, teamRole });
  });
}

/** `requirePermission` for `[param]` routes (mirrors `withTenantAuthParams`). */
export function requirePermissionParams(
  key: PermissionKey,
  handler: (
    req: NextRequest,
    ctx: PermissionAuthContext,
    params: Record<string, string>,
  ) => Promise<NextResponse>,
) {
  return withTenantAuthParams(async (req, ctx, params) => {
    const { permissions, teamRole } = await resolveUserPermissions(ctx.user, ctx.tenantId);
    if (!can(permissions, key)) return FORBIDDEN();
    return handler(req, { ...ctx, permissions, teamRole }, params);
  });
}
