import { ApiError } from "@/lib/api-error";

/**
 * Path-parameter validation helpers (PRD-204 AC-1).
 *
 * Reject malformed route params at the boundary so a raw, attacker-controlled
 * string never reaches a Prisma `where` clause or gets interpolated into a
 * derived value. Both helpers throw `ApiError(.., 400)`; route handlers that
 * funnel errors through `apiError(error, { route })` surface a clean 400.
 */

/**
 * Lenient, version-agnostic UUID matcher. We do NOT pin the version/variant
 * nibbles because ids in this app come from several sources (Prisma
 * `uuid()`, Postgres `gen_random_uuid()`, and app-side `crypto.randomUUID()`);
 * a strict v4 pattern would false-reject otherwise-valid ids.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Subdomain/slug charset: lowercase alnum, internal hyphens, 1-63 chars. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Opaque primary-key charset: alphanumerics plus `-` and `_`, 1-64 chars. Wide
 * enough for a UUID, a cuid and a nanoid; narrow enough that nothing which
 * reaches a `where` clause can carry a wildcard, a quote, a path separator or
 * whitespace.
 */
const ENTITY_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Validate a path param expected to be a UUID. Returns the trimmed value on
 * success; throws `ApiError("Invalid request", 400)` otherwise.
 */
export function parseUuid(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || !UUID_RE.test(trimmed)) {
    throw new ApiError("Invalid request", 400);
  }
  return trimmed;
}

/**
 * Validate a path param expected to be an opaque row id on a model whose `id`
 * carries NO database-level default — `conditions` declares `id String @id`
 * (prisma/schema.prisma), so its ids are whatever the writer supplied.
 * `crypto.randomUUID()` today (scripts/seed-conditions.ts:497), but nothing in
 * the schema guarantees that, so `parseUuid` would 400 a perfectly valid row.
 *
 * Same contract as the other two: trimmed value on success, `ApiError("Invalid
 * request", 400)` otherwise. Use `parseUuid` wherever the column really is a
 * uuid — this is the looser gate, not the default one.
 */
export function parseEntityId(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || !ENTITY_ID_RE.test(trimmed)) {
    throw new ApiError("Invalid request", 400);
  }
  return trimmed;
}

/**
 * Validate a path param expected to be a tenant subdomain / slug. Returns the
 * trimmed value on success; throws `ApiError("Invalid request", 400)`
 * otherwise.
 */
export function parseSlug(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || !SLUG_RE.test(trimmed)) {
    throw new ApiError("Invalid request", 400);
  }
  return trimmed;
}
