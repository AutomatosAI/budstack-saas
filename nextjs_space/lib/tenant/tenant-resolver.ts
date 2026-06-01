import { headers } from "next/headers";
import type { tenants } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseHostToTenantHint } from "@/lib/parse-host";

// PRD-205 — the ONE canonical tenant resolver. Every other helper
// (lib/tenant.ts ×5, lib/resolve-tenant-id.ts, the drgreen webhook route) is a
// thin delegator onto this. It RETURNS the tenant and NEVER binds the ALS —
// binding is PRD-202's job (runWithTenantContext at the request boundary).
//
// users.email SINGLE-TENANT ASSUMPTION (load-bearing):
//   prisma `users.email` is GLOBALLY @unique with a nullable tenantId, which
//   structurally forbids one human existing in two tenants. The Clerk/email
//   fallback below is only unambiguous *because* of that constraint. The
//   ambiguous-result path (AmbiguousTenantResolution) is what keeps it safe once
//   PRD-208 migrates `users.email` to @@unique([email, tenantId]). See US-007 /
//   prisma/schema.prisma for the migration spec.

// The generated Prisma model type. We import it explicitly rather than infer it
// from `prisma.tenants.findFirst`, because lib/db.ts's build-time mock widens the
// exported `prisma` to `any`, which would collapse an inferred Tenant to `any`.
type Tenant = tenants;

export type ResolveTenantInput =
  | { kind: "headers" }
  | { kind: "host"; host: string; pathname: string }
  | { kind: "slug"; slug: string }
  | { kind: "clerk"; clerkOrgId: string | null | undefined; email: string | null | undefined };

export type ResolvedTenant = { tenantId: string; tenant: Tenant };

/**
 * Returned (never thrown) when an email resolves to more than one ACTIVE tenant.
 * Today the global `users.email @unique` makes this impossible; after the PRD-208
 * migration it becomes reachable. PRD-203's getCurrentUser consumes it as a 403 —
 * the resolver must never silently pick the first row.
 */
export type AmbiguousTenantResolution = {
  kind: "ambiguous";
  source: string;
  email: string;
  candidateCount: number;
};

export function isAmbiguousTenantResolution(
  value: unknown,
): value is AmbiguousTenantResolution {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "ambiguous"
  );
}

function emitResolverEvent(event: string, payload: Record<string, unknown>): void {
  // Structured audit line (PRD §10); PRD-215 formalises the sink.
  console.warn(event, JSON.stringify({ event, ...payload }));
}

// --- canonical lookups (the ONE place isActive + lower-case retry live) -------

async function bySubdomain(subdomain: string): Promise<ResolvedTenant | null> {
  let tenant = await prisma.tenants.findFirst({
    where: { subdomain, isActive: true },
  });
  if (!tenant && subdomain !== subdomain.toLowerCase()) {
    tenant = await prisma.tenants.findFirst({
      where: { subdomain: subdomain.toLowerCase(), isActive: true },
    });
  }
  return tenant ? { tenantId: tenant.id, tenant } : null;
}

async function byCustomDomain(host: string): Promise<ResolvedTenant | null> {
  const tenant = await prisma.tenants.findFirst({
    where: { customDomain: host, isActive: true },
  });
  return tenant ? { tenantId: tenant.id, tenant } : null;
}

async function byHost(host: string, pathname: string): Promise<ResolvedTenant | null> {
  // Path-based routing (localhost/dev): /store/{slug} wins, matching the prior
  // getTenantFromRequest ordering.
  const pathMatch = pathname.match(/^\/store\/([^/]+)/);
  if (pathMatch) return bySubdomain(pathMatch[1]);

  const hint = parseHostToTenantHint(host);
  if (!hint) return null;
  return hint.kind === "subdomain"
    ? bySubdomain(hint.subdomain)
    : byCustomDomain(hint.host);
}

async function byHeaders(): Promise<ResolvedTenant | null> {
  const headersList = headers();
  const slug = headersList.get("x-tenant-slug");
  const subdomain = headersList.get("x-tenant-subdomain");
  const customDomain = headersList.get("x-tenant-custom-domain");

  if (slug) return bySubdomain(slug);
  if (subdomain) return bySubdomain(subdomain);
  if (customDomain) return byCustomDomain(customDomain);
  return null;
}

async function byClerk(
  clerkOrgId: string | null | undefined,
  email: string | null | undefined,
): Promise<ResolvedTenant | AmbiguousTenantResolution | null> {
  // Prefer the Clerk-org → settings.clerkOrgId match (now isActive-enforced).
  if (clerkOrgId) {
    try {
      const tenant = await prisma.tenants.findFirst({
        where: { isActive: true, settings: { path: ["clerkOrgId"], equals: clerkOrgId } },
      });
      if (tenant) return { tenantId: tenant.id, tenant };
    } catch (error) {
      emitResolverEvent("tenant.resolution_clerk_org_query_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Email fallback — now isActive-enforced and ambiguity-aware (closes the
  // resolve-tenant-id.ts:37-47 unscoped/inactive gap, AC-1b).
  if (email) {
    const usersForEmail: Array<{ tenants: Tenant | null }> =
      await prisma.users.findMany({
        where: { email },
        include: { tenants: true },
      });
    const activeTenants = usersForEmail
      .map((u) => u.tenants)
      .filter((t): t is Tenant => t != null && t.isActive);
    const distinct = Array.from(new Map(activeTenants.map((t) => [t.id, t])).values());

    if (distinct.length === 0) {
      if (usersForEmail.some((u) => u.tenants != null)) {
        emitResolverEvent("tenant.resolved_inactive_blocked", { source: "clerk-email", email });
      }
      return null;
    }
    if (distinct.length > 1) {
      emitResolverEvent("tenant.resolution_ambiguous", {
        source: "clerk-email",
        email,
        candidateCount: distinct.length,
      });
      return { kind: "ambiguous", source: "clerk-email", email, candidateCount: distinct.length };
    }
    return { tenantId: distinct[0].id, tenant: distinct[0] };
  }

  return null;
}

// --- public surface (overloaded so only the clerk path carries Ambiguous) -----

export function resolveTenant(
  input: { kind: "headers" } | { kind: "host"; host: string; pathname: string } | { kind: "slug"; slug: string },
): Promise<ResolvedTenant | null>;
export function resolveTenant(
  input: { kind: "clerk"; clerkOrgId: string | null | undefined; email: string | null | undefined },
): Promise<ResolvedTenant | AmbiguousTenantResolution | null>;
export function resolveTenant(
  input: ResolveTenantInput,
): Promise<ResolvedTenant | AmbiguousTenantResolution | null> {
  switch (input.kind) {
    case "headers":
      return byHeaders();
    case "host":
      return byHost(input.host, input.pathname);
    case "slug":
      return bySubdomain(input.slug);
    case "clerk":
      return byClerk(input.clerkOrgId, input.email);
  }
}
