/**
 * AUTH_PUBLIC_ROUTES — the reviewed allow-list of `app/api` routes that are
 * intentionally reachable WITHOUT one of the api-auth wrappers
 * (`withTenantAuth` / `withTenantAuthParams` / `withSuperAdmin` /
 * `withSuperAdminParams` / `withAuth`).
 *
 * DEFAULT-DENY: any `app/api` route NOT matched here MUST be wrapped. The
 * `check-auth-wrappers` gate (PRD-203 US-002 report-only → US-010 blocking)
 * fails the build on any exported HTTP handler that is neither wrapped nor
 * matched by this list.
 *
 * Only genuinely public READS and pre-auth / signature-verified endpoints
 * belong here. Storefront cart / orders / submit are AUTHENTICATED (`withAuth`),
 * NOT public — they are deliberately absent. `consultation/submit` and
 * `onboarding` ARE listed: both are pre-auth intake that MINT the Clerk user
 * (and, for onboarding, the tenant) — they cannot require a session because
 * they create it (same posture as `signup`). Resolved in US-009.
 *
 * Patterns use the Next.js app-router path with `[param]` placeholders, as
 * derived from each file path: `app/api/<segments>/route.ts` → `/api/<segments>`.
 * A `[param]` segment matches exactly one non-empty path segment, so the gate
 * can pass either the placeholder path or a concrete request path.
 */

export interface PublicRoute {
  /** API path with `[param]` placeholders, e.g. `/api/store/[slug]/products`. */
  readonly pattern: string;
  /** One-line justification for why this route is exempt from the wrappers. */
  readonly reason: string;
}

export const AUTH_PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    pattern: "/api/health",
    reason:
      "Liveness/readiness probe; no tenant or user data; must answer pre-auth for load balancers.",
  },
  {
    pattern: "/api/webhooks/clerk",
    reason:
      "Clerk webhook; verifies its own Svix signature (webhook auth owned by PRD-211).",
  },
  {
    pattern: "/api/webhooks/drgreen/crypto",
    reason:
      "Dr Green crypto webhook; verifies its own provider signature (PRD-211).",
  },
  {
    pattern: "/api/webhooks/drgreen/fiat",
    reason:
      "Dr Green fiat webhook; verifies its own provider signature (PRD-211).",
  },
  {
    pattern: "/api/webhooks/drgreen/status",
    reason:
      "Dr Green status webhook; verifies its own provider signature (PRD-211).",
  },
  {
    pattern: "/api/signup",
    reason: "Pre-auth account creation; no Clerk session exists yet.",
  },
  {
    pattern: "/api/consultation/submit",
    reason:
      "Pre-auth patient intake: resolves tenant by host, then MINTS the Clerk user + DB user + questionnaire; cannot require a session (own IP rate-limit + Zod whitelist).",
  },
  {
    pattern: "/api/onboarding",
    reason:
      "Pre-auth tenant registration: creates the Clerk user + Clerk org + tenant before any session exists (own IP rate-limit + Zod, Clerk rollback on DB failure).",
  },
  {
    pattern: "/api/auth/reset-password",
    reason:
      "Pre-auth password reset; caller cannot be authenticated by definition (own token + rate-limit).",
  },
  {
    pattern: "/api/doctor-green/products",
    reason:
      "Public storefront product catalogue (Dr Green feed), resolved by host tenant; no user data.",
  },
  {
    pattern: "/api/tenant/current",
    reason:
      "Public storefront bootstrap: returns the current tenant by host; no user data.",
  },
  {
    pattern: "/api/tenant/conditions",
    reason:
      "Public storefront read: medical conditions list resolved by host/slug.",
  },
  {
    pattern: "/api/tenant/conditions/[slug]",
    reason: "Public storefront read: single medical condition by slug.",
  },
  {
    pattern: "/api/store/[slug]/products",
    reason: "Public storefront read: product list by tenant slug.",
  },
  {
    pattern: "/api/store/[slug]/products/featured",
    reason: "Public storefront read: featured products by tenant slug.",
  },
];

/**
 * Convert a `[param]`-style allow-list pattern into an anchored RegExp that
 * matches exactly one non-empty segment per `[param]` placeholder.
 */
function patternToRegExp(pattern: string): RegExp {
  const body = pattern
    .split("/")
    .map((segment) =>
      segment.startsWith("[") && segment.endsWith("]")
        ? "[^/]+"
        : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${body}$`);
}

const PUBLIC_ROUTE_MATCHERS: readonly RegExp[] = AUTH_PUBLIC_ROUTES.map(
  (route) => patternToRegExp(route.pattern),
);

/**
 * True when `apiPath` matches a reviewed public route. Accepts either the
 * `[param]`-placeholder path (as the gate derives from a file path) or a
 * concrete request path with real segment values. Used by the
 * check-auth-wrappers gate (US-002) to exempt allow-listed routes.
 */
export function isAuthPublicRoute(apiPath: string): boolean {
  const normalized = apiPath.replace(/\/+$/, "") || "/";
  return PUBLIC_ROUTE_MATCHERS.some((matcher) => matcher.test(normalized));
}
