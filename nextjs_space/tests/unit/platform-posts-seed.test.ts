import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseUuid } from "@/lib/validation/parse-uuid";

/**
 * US-010 / US-011 — regression guards for the two seeds that move the blog out
 * of code and into `platform_posts`: the editorial pair from lib/blog/posts.ts,
 * and the six samples from the `samplePosts` array in app/blog/[slug]/page.tsx.
 *
 * Offline, like platform-posts-schema.test.ts: this reads the migrations as
 * text. No database, no generated client.
 *
 * The four ways either seed silently fails:
 *
 *  1. A loose .sql at the top of prisma/migrations/ is never read by
 *     `prisma migrate deploy` (entrypoint.sh runs it on boot). Seven such files
 *     up there have never been applied; this asserts each seed is a DIRECTORY.
 *  2. A seed that sorts BEFORE the CREATE TABLE runs against a table that does
 *     not exist yet and fails the deploy — and `migrate deploy` applies
 *     directories in lexicographic order, so the guard is on the name.
 *  3. Without ON CONFLICT, a replayed history or a restored database that
 *     already carries the rows either duplicates a post or errors the boot.
 *  4. A "tidied" slug 404s a URL that is already indexed and already linked to.
 *     The eight below are the live URLs; they are asserted verbatim rather than
 *     read from the arrays precisely because US-012 deletes those — the
 *     invariant outlives its source.
 */

const root = process.cwd(); // vitest runs from nextjs_space/
const migrationsDir = join(root, "prisma", "migrations");

/** Character-for-character the slugs the inline arrays shipped. */
const EDITORIAL_SLUGS = [
  "wordpress-or-budstacks-cannabis-storefront",
  "real-economics-medical-cannabis-storefront",
] as const;

const SAMPLE_SLUGS = [
  "getting-started-with-medical-cannabis-franchise",
  "understanding-dr-green-api-integration",
  "blockchain-traceability-compliance",
  "scaling-multi-tenant-operations",
  "customer-management-best-practices",
  "maximizing-revenue-analytics",
] as const;

const EDITORIAL_SEED_RE = /^\d{14}_seed_editorial_platform_posts$/;
const SAMPLE_SEED_RE = /^\d{14}_seed_sample_platform_posts$/;
const CREATE_DIR_RE = /^\d{14}_add_platform_posts$/;

function migrationEntries() {
  return readdirSync(migrationsDir, { withFileTypes: true });
}

function seedDirNameFor(pattern: RegExp): string {
  const dir = migrationEntries().find(
    (e) => e.isDirectory() && pattern.test(e.name),
  );
  if (!dir) {
    throw new Error(
      `expected a <14-digit-timestamp> directory matching ${pattern}`,
    );
  }
  return dir.name;
}

const sqlFor = (pattern: RegExp) =>
  readFileSync(
    join(migrationsDir, seedDirNameFor(pattern), "migration.sql"),
    "utf8",
  );

const seedDirName = () => seedDirNameFor(EDITORIAL_SEED_RE);
const seedSql = () => sqlFor(EDITORIAL_SEED_RE);

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

/**
 * US-011 — the same guarantees for the six samples. They are placeholder prose
 * awaiting a human rewrite, and they ship published anyway: the URLs are
 * already indexed and already linked to, so a live URL beats a 404 while the
 * copy is being fixed.
 */
const sampleSql = () => sqlFor(SAMPLE_SEED_RE);

describe("the sample seed is deployable (US-011)", () => {
  it("ships as a timestamped directory, not a loose .sql", () => {
    expect(() => seedDirNameFor(SAMPLE_SEED_RE)).not.toThrow();
  });

  it("sorts after the migration that creates the table", () => {
    const create = migrationEntries().find(
      (e) => e.isDirectory() && CREATE_DIR_RE.test(e.name),
    );
    expect(create, "platform_posts CREATE TABLE migration missing").toBeDefined();
    expect(seedDirNameFor(SAMPLE_SEED_RE) > create!.name).toBe(true);
  });

  it("inserts into platform_posts and creates no schema", () => {
    const sql = sampleSql();
    expect(sql).toContain('INSERT INTO "platform_posts"');
    expect(sql).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP /);
  });
});

describe("the sample seed is idempotent (US-011)", () => {
  it("takes no action on a slug that already exists", () => {
    // Not DO UPDATE — these rows get REWRITTEN by a human in
    // /super-admin/the-wire, and a redeploy must not undo that edit.
    expect(sampleSql()).toMatch(/ON CONFLICT\s*\(\s*"slug"\s*\)\s*DO NOTHING/);
    expect(sampleSql()).not.toMatch(/DO UPDATE/);
  });
});

describe("the sample seed keeps the live URLs (US-011)", () => {
  it.each(SAMPLE_SLUGS)("carries %s verbatim", (slug) => {
    expect(sampleSql()).toContain(`'${slug}'`);
  });

  it("publishes all six, so the URLs resolve", () => {
    const sql = sampleSql();
    expect(sql.match(/\btrue\b/g)).toHaveLength(SAMPLE_SLUGS.length);
    expect(sql).not.toMatch(/\bfalse\b/);
  });

  it("gives each row an id the admin API will accept", () => {
    // The rewrite happens through /api/platform/posts/[id], which runs
    // parseUuid on the path param — a non-UUID key would make the very rows a
    // human needs to open uneditable.
    const ids = [...sampleSql().matchAll(/\(\s*'([0-9a-f-]{36})'\s*,/g)].map(
      (m) => m[1],
    );
    expect(ids).toHaveLength(SAMPLE_SLUGS.length);
    for (const id of ids) expect(() => parseUuid(id)).not.toThrow();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders the six deterministically", () => {
    const stamps = [
      ...sampleSql().matchAll(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'/g),
    ].map((m) => m[1]);
    const publishedAt = stamps.filter((_, i) => i % 3 === 0);
    expect(publishedAt).toHaveLength(SAMPLE_SLUGS.length);
    expect(new Set(publishedAt).size).toBe(publishedAt.length);
  });

  it("keeps every id distinct from the editorial seed's", () => {
    // Both seeds INSERT into the same table; a shared id would fail the second
    // one on the primary key and take the whole deploy down with it.
    const ids = (sql: string) =>
      [...sql.matchAll(/\(\s*'([0-9a-f-]{36})'\s*,/g)].map((m) => m[1]);
    const overlap = ids(sampleSql()).filter((id) =>
      ids(seedSql()).includes(id),
    );
    expect(overlap).toEqual([]);
  });
});

describe("all eight posts are now rows (US-011)", () => {
  it("covers every slug the two inline arrays shipped", () => {
    const combined = seedSql() + sampleSql();
    for (const slug of [...EDITORIAL_SLUGS, ...SAMPLE_SLUGS]) {
      expect(combined).toContain(`'${slug}'`);
    }
    // The precondition US-012 checks before deleting the arrays.
    expect(EDITORIAL_SLUGS.length + SAMPLE_SLUGS.length).toBe(8);
  });
});
