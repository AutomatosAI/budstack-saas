import { NextRequest } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant-context";

/**
 * PRD-202 AC-3 — bind tenant context at the request boundary.
 *
 * `withTenantContext` resolves the request's tenant (a pure lookup — it uses the
 * resolver's RETURN value, never an ALS side-effect) and then runs the ENTIRE
 * handler inside one `runWithTenantContextAsync` scope. Every Prisma call the
 * handler makes therefore executes under the correct, confined tenant context,
 * which the `lib/db.ts` middleware reads — and which can never leak into a
 * concurrent request's continuation (the bug this PRD fixes).
 *
 * This is the context-binding primitive. PRD-203's `withTenantAuth` composes
 * this wrapper to add role/ownership checks; the bulk route migration rides on
 * that. This PRD wires one pilot route (US-007) to prove the pattern end-to-end.
 *
 * A `null` resolution is bound explicitly (an anonymous/unresolved storefront
 * request): the handler runs inside `runWithTenantContextAsync(null, ...)`, so
 * `hasTenantContext()` is true and the middleware treats it as a deliberate,
 * non-tenant-scoped request rather than the implicit-unbound failure mode.
 */
type RouteHandler<Args extends unknown[]> = (
  req: NextRequest,
  ...args: Args
) => Promise<Response>;

export function withTenantContext<Args extends unknown[]>(
  handler: RouteHandler<Args>,
): RouteHandler<Args> {
  return async (req: NextRequest, ...args: Args): Promise<Response> => {
    const tenant = await getTenantFromRequest(req);
    return runWithTenantContextAsync(tenant?.id ?? null, () =>
      handler(req, ...args),
    );
  };
}
