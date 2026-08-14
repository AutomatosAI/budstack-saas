/**
 * Tenant plan values and the fail-closed parser for `tenants.plan`.
 *
 * The column is the SINGLE source of truth for what a tenant has paid for
 * (SEO Supercharge US-011). It is operator-set from the super-admin console;
 * there is no billing integration. Two things it deliberately is not:
 *
 * - not `tenants.settings` — that JSON is tenant-writable via the settings
 *   PATCH routes, so a tenant could grant itself Pro;
 * - not a Clerk claim — Clerk org `publicMetadata.plan` is a best-effort mirror
 *   written on change and NEVER read back, so a failed/stale Clerk sync can
 *   neither lock a paying tenant out nor unlock a Basic one.
 *
 * Pure module: no Prisma, no Clerk, no I/O. The DB read lives in
 * `require-feature.ts`, the matrix in `features.ts`.
 */

export const PLANS = ["trial", "basic", "pro", "custom"] as const;

export type Plan = (typeof PLANS)[number];

/**
 * What a brand-new tenant gets — the 3-month all-features launch window.
 * Mirrored by the column's DB-level `DEFAULT 'trial'`.
 */
export const DEFAULT_PLAN: Plan = "trial";

/**
 * Where an unreadable plan lands. 'basic' is the paid floor: an unrecognised
 * value, a missing column, or a failed query degrades the tenant to the
 * cheapest tier rather than granting Pro. It is never 'trial' — trial grants
 * everything, so a parse failure must not be a free upgrade.
 */
export const FAIL_CLOSED_PLAN: Plan = "basic";

const KNOWN_PLANS: ReadonlySet<string> = new Set(PLANS);

/**
 * Parse an untrusted `tenants.plan` value.
 *
 * Fail-closed and exact-match: `undefined`, `null`, `''`, `'PRO'`, `'enterprise'`,
 * a number, an object — every one of them resolves to {@link FAIL_CLOSED_PLAN}.
 * No trimming, no case-folding: the writer (US-012's super-admin selector) is
 * constrained to {@link PLANS}, so anything else in the column arrived by a
 * manual DB edit or a future migration and should not be guessed at.
 */
export function parsePlan(value: unknown): Plan {
  if (typeof value !== "string") return FAIL_CLOSED_PLAN;
  return KNOWN_PLANS.has(value) ? (value as Plan) : FAIL_CLOSED_PLAN;
}

/** Type guard for callers validating operator input before a write. */
export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && KNOWN_PLANS.has(value);
}
