import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * US-002 — regression guards for the three ways platform_posts silently breaks.
 *
 * All offline: they read the schema and lib/db.ts as text, no DB and no
 * generated client, matching prisma-relation-names.test.ts.
 *
 *  1. `tenantScopedModels` in lib/db.ts is an OPT-IN allowlist, so the repo-wide
 *     "a new model joins tenantScopedModels" convention is INVERTED for platform
 *     tables. Adding platform_posts welds a tenantId filter onto every apex
 *     query, which returns nothing rather than erroring — a silent empty blog.
 *  2. The author is denormalised strings. A `users` relation would be both
 *     unreadable from the apex (users is itself scoped) and a P2003 waiting to
 *     happen, because getCurrentUser().id is a Clerk id, not a users.id — the
 *     failure that broke the lekkerweed blog in PR #226.
 *  3. `prisma migrate deploy` (run by entrypoint.sh on boot) only reads
 *     migration DIRECTORIES. Seven loose .sql files at the top of
 *     prisma/migrations/ have never been applied by a deploy; this asserts
 *     platform_posts did not become the eighth.
 */

const root = process.cwd(); // vitest runs from nextjs_space/

const schema = () => readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

function modelBody(modelName: string): string {
  const match = schema().match(
    new RegExp(`^model\\s+${modelName}\\s+\\{([\\s\\S]*?)^\\}`, "m"),
  );
  if (!match) throw new Error(`model ${modelName} not found in schema.prisma`);
  return match[1];
}

function modelFields(modelName: string): string[] {
  return modelBody(modelName)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("@@") &&
        !line.startsWith("//") &&
        !line.startsWith("///"),
    )
    .map((line) => line.split(/\s+/)[0]);
}

describe("platform_posts is not tenant-scoped (US-002)", () => {
  const scopedAllowlist = () => {
    const db = readFileSync(join(root, "lib", "db.ts"), "utf8");
    const match = db.match(/const tenantScopedModels = new Set\(\[([\s\S]*?)\]\)/);
    if (!match) throw new Error("tenantScopedModels not found in lib/db.ts");
    return match[1];
  };

  it.each(["platform_posts", "platform_leads", "learning_resources"])(
    "platform model %s stays OUT of tenantScopedModels",
    (model) => {
      expect(scopedAllowlist()).not.toContain(`'${model}'`);
      expect(scopedAllowlist()).not.toContain(`"${model}"`);
    },
  );

  it("the allowlist still scopes the tenant tables platform_posts is separate from", () => {
    // If these ever drop out, platform_posts being absent stops meaning anything.
    expect(scopedAllowlist()).toContain("'posts'");
    expect(scopedAllowlist()).toContain("'users'");
  });
});

describe("platform_posts author is denormalised (US-002)", () => {
  it("carries authorName/authorRole strings", () => {
    const fields = modelFields("platform_posts");
    expect(fields).toContain("authorName");
    expect(fields).toContain("authorRole");
  });

  it("has no users relation and no author FK", () => {
    const fields = modelFields("platform_posts");
    expect(fields).not.toContain("users");
    expect(fields).not.toContain("authorId");
    expect(modelBody("platform_posts")).not.toMatch(/@relation/);
  });

  it("has no tenantId — it belongs to the platform, not a store", () => {
    expect(modelFields("platform_posts")).not.toContain("tenantId");
  });
});

describe("platform_posts migration is deployable (US-002)", () => {
  const migrationsDir = join(root, "prisma", "migrations");

  it("ships as a timestamped directory, not a loose .sql", () => {
    const entries = readdirSync(migrationsDir, { withFileTypes: true });

    const dir = entries.find(
      (e) => e.isDirectory() && /^\d{14}_add_platform_posts$/.test(e.name),
    );
    expect(dir, "expected a <14-digit-timestamp>_add_platform_posts directory").toBeDefined();

    // `migrate deploy` never reads these, so one here would never run.
    const loose = entries.filter(
      (e) => e.isFile() && e.name.includes("platform_posts"),
    );
    expect(loose.map((e) => e.name)).toEqual([]);
  });

  it("creates the table and both indexes", () => {
    const entries = readdirSync(migrationsDir, { withFileTypes: true });
    const dir = entries.find(
      (e) => e.isDirectory() && /^\d{14}_add_platform_posts$/.test(e.name),
    )!;
    const sql = readFileSync(join(migrationsDir, dir.name, "migration.sql"), "utf8");

    expect(sql).toContain('CREATE TABLE "platform_posts"');
    expect(sql).toContain('CREATE UNIQUE INDEX "platform_posts_slug_key"');
    expect(sql).toContain('CREATE INDEX "platform_posts_published_publishedAt_idx"');
    // No FK: the author is strings, and the table has no tenant.
    expect(sql).not.toMatch(/FOREIGN KEY/);
  });
});
