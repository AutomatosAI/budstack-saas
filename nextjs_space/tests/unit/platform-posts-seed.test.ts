import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseUuid } from "@/lib/validation/parse-uuid";

/**
 * US-010 — regression guards for the seed that moves the two editorial posts
 * out of lib/blog/posts.ts and into `platform_posts`.
 *
 * Offline, like platform-posts-schema.test.ts: this reads the migration as
 * text. No database, no generated client.
 *
 * The four ways this seed silently fails:
 *
 *  1. A loose .sql at the top of prisma/migrations/ is never read by
 *     `prisma migrate deploy` (entrypoint.sh runs it on boot). Seven such files
 *     up there have never been applied; this asserts the seed is a DIRECTORY.
 *  2. A seed that sorts BEFORE the CREATE TABLE runs against a table that does
 *     not exist yet and fails the deploy — and `migrate deploy` applies
 *     directories in lexicographic order, so the guard is on the name.
 *  3. Without ON CONFLICT, a replayed history or a restored database that
 *     already carries the rows either duplicates a post or errors the boot.
 *  4. A "tidied" slug 404s a URL that is already indexed and already linked to.
 *     The two below are the live URLs; they are asserted verbatim rather than
 *     read from lib/blog/posts.ts precisely because US-012 deletes that file —
 *     the invariant outlives its source.
 */

const root = process.cwd(); // vitest runs from nextjs_space/
const migrationsDir = join(root, "prisma", "migrations");

/** Character-for-character the slugs the inline array shipped. */
const EDITORIAL_SLUGS = [
  "wordpress-or-budstacks-cannabis-storefront",
  "real-economics-medical-cannabis-storefront",
] as const;

const SEED_DIR_RE = /^\d{14}_seed_editorial_platform_posts$/;
const CREATE_DIR_RE = /^\d{14}_add_platform_posts$/;

function migrationEntries() {
  return readdirSync(migrationsDir, { withFileTypes: true });
}

function seedDirName(): string {
  const dir = migrationEntries().find(
    (e) => e.isDirectory() && SEED_DIR_RE.test(e.name),
  );
  if (!dir) {
    throw new Error(
      "expected a <14-digit-timestamp>_seed_editorial_platform_posts directory",
    );
  }
  return dir.name;
}

const seedSql = () =>
  readFileSync(join(migrationsDir, seedDirName(), "migration.sql"), "utf8");

describe("the editorial seed is deployable (US-010)", () => {
  it("ships as a timestamped directory, not a loose .sql", () => {
    expect(() => seedDirName()).not.toThrow();

    // `migrate deploy` never reads a file here, so one would never run.
    const loose = migrationEntries().filter(
      (e) => e.isFile() && /platform_posts/.test(e.name),
    );
    expect(loose.map((e) => e.name)).toEqual([]);
  });

  it("sorts after the migration that creates the table", () => {
    const create = migrationEntries().find(
      (e) => e.isDirectory() && CREATE_DIR_RE.test(e.name),
    );
    expect(create, "platform_posts CREATE TABLE migration missing").toBeDefined();

    // Lexicographic — the order `migrate deploy` itself applies them in.
    expect(seedDirName() > create!.name).toBe(true);
  });

  it("inserts into platform_posts and creates no schema", () => {
    const sql = seedSql();
    expect(sql).toContain('INSERT INTO "platform_posts"');
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP /);
  });
});

describe("the editorial seed is idempotent (US-010)", () => {
  it("takes no action on a slug that already exists", () => {
    // Not DO UPDATE: a re-run must never overwrite an edit a super-admin has
    // since made in /super-admin/the-wire.
    expect(seedSql()).toMatch(/ON CONFLICT\s*\(\s*"slug"\s*\)\s*DO NOTHING/);
    expect(seedSql()).not.toMatch(/DO UPDATE/);
  });
});

describe("the editorial seed keeps the live URLs (US-010)", () => {
  it.each(EDITORIAL_SLUGS)("carries %s verbatim", (slug) => {
    expect(seedSql()).toContain(`'${slug}'`);
  });

  it("publishes both posts, so the URLs resolve", () => {
    const sql = seedSql();
    // Two rows, each ending `..., true, <3 timestamps>)`.
    expect(sql.match(/\btrue\b/g)).toHaveLength(EDITORIAL_SLUGS.length);
    expect(sql).not.toMatch(/\bfalse\b/);
  });

  it("gives each row an id the admin API will accept", () => {
    // /api/platform/posts/[id] runs parseUuid on the path param — a row keyed
    // anything else would be published but uneditable and undeletable.
    const ids = [...seedSql().matchAll(/\(\s*'([0-9a-f-]{36})'\s*,/g)].map(
      (m) => m[1],
    );
    expect(ids).toHaveLength(EDITORIAL_SLUGS.length);
    for (const id of ids) expect(() => parseUuid(id)).not.toThrow();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders the pair deterministically", () => {
    // Both posts shipped the same date string. The index sorts by publishedAt
    // DESC, so identical timestamps would order arbitrarily between deploys.
    const stamps = [...seedSql().matchAll(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'/g)]
      .map((m) => m[1]);
    const publishedAt = stamps.filter((_, i) => i % 3 === 0);
    expect(publishedAt).toHaveLength(EDITORIAL_SLUGS.length);
    expect(new Set(publishedAt).size).toBe(publishedAt.length);
  });
});
