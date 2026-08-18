import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLATFORM_DEFAULT_OG_IMAGE } from "@/lib/seo/platform-post-metadata";

/**
 * US-013 — regression guards for the ways platform_seo_settings silently breaks.
 *
 * Offline, like platform-posts-schema.test.ts: they read the schema, lib/db.ts
 * and the migration as text, with no DB and no generated client.
 *
 *  1. `tenantScopedModels` in lib/db.ts is an OPT-IN allowlist, so the repo-wide
 *     "a new model joins tenantScopedModels" convention is INVERTED for platform
 *     tables. Adding this one welds a tenantId filter onto every apex query,
 *     which returns nothing rather than erroring — every marketing page would
 *     quietly fall back to the layout defaults with no error to notice.
 *  2. Every authored column is NULLABLE, because a row is an override and the
 *     route's existing metadata is the documented fallback (US-015). A NOT NULL
 *     title would force the seed to freeze copy into SQL.
 *  3. `prisma migrate deploy` (run by entrypoint.sh on boot) only reads
 *     migration DIRECTORIES. Seven loose .sql files at the top of
 *     prisma/migrations/ have never been applied by a deploy.
 *  4. The seed leaves no static marketing route without an OG image, and its
 *     image is the same constant the blog already falls back to.
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

function modelFieldLines(modelName: string): string[] {
  return modelBody(modelName)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("@@") &&
        !line.startsWith("//") &&
        !line.startsWith("///"),
    );
}

function modelFields(modelName: string): string[] {
  return modelFieldLines(modelName).map((line) => line.split(/\s+/)[0]);
}

/** The static marketing routes middleware.ts's isPublicRoute allowlist exposes. */
const SEEDED_ROUTES = [
  "/",
  "/marketplace",
  "/learn",
  "/blog",
  "/contact",
  "/documents",
  "/faq",
  "/regulatory",
  "/terms",
  "/privacy",
  "/cookies",
  "/dpa",
  "/aup",
  "/legal/changelog",
  "/legal/subprocessors",
] as const;

const migrationsDir = join(root, "prisma", "migrations");

function migrationDir(): string {
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  const dir = entries.find(
    (e) => e.isDirectory() && /^\d{14}_add_platform_seo_settings$/.test(e.name),
  );
  if (!dir) {
    throw new Error(
      "expected a <14-digit-timestamp>_add_platform_seo_settings directory",
    );
  }
  return dir.name;
}

const migrationSql = () =>
  readFileSync(join(migrationsDir, migrationDir(), "migration.sql"), "utf8");

describe("platform_seo_settings is not tenant-scoped (US-013)", () => {
  const scopedAllowlist = () => {
    const db = readFileSync(join(root, "lib", "db.ts"), "utf8");
    const match = db.match(/const tenantScopedModels = new Set\(\[([\s\S]*?)\]\)/);
    if (!match) throw new Error("tenantScopedModels not found in lib/db.ts");
    return match[1];
  };

  it.each([
    "platform_seo_settings",
    "platform_posts",
    "platform_leads",
    "learning_resources",
  ])("platform model %s stays OUT of tenantScopedModels", (model) => {
    expect(scopedAllowlist()).not.toContain(`'${model}'`);
    expect(scopedAllowlist()).not.toContain(`"${model}"`);
  });

  it("has no tenantId — budstacks.io's own metadata belongs to no store", () => {
    expect(modelFields("platform_seo_settings")).not.toContain("tenantId");
    expect(modelBody("platform_seo_settings")).not.toMatch(/@relation/);
  });
});

describe("platform_seo_settings shape (US-013)", () => {
  it("is keyed by a unique routePath", () => {
    expect(modelFields("platform_seo_settings")).toContain("routePath");
    expect(modelFieldLines("platform_seo_settings")).toContainEqual(
      expect.stringMatching(/^routePath\s+String\s+@unique$/),
    );
  });

  it("carries title, description, ogImage, noindex and both timestamps", () => {
    const fields = modelFields("platform_seo_settings");
    for (const field of [
      "title",
      "description",
      "ogImage",
      "noindex",
      "createdAt",
      "updatedAt",
    ]) {
      expect(fields).toContain(field);
    }
  });

  it.each(["title", "description", "ogImage"])(
    "leaves %s nullable, so a row overrides per field rather than replacing",
    (field) => {
      expect(modelFieldLines("platform_seo_settings")).toContainEqual(
        expect.stringMatching(new RegExp(`^${field}\\s+String\\?`)),
      );
    },
  );

  it("defaults noindex to false — a row must not drop a page from the index", () => {
    expect(modelFieldLines("platform_seo_settings")).toContainEqual(
      expect.stringMatching(/^noindex\s+Boolean\s+@default\(false\)$/),
    );
  });
});

describe("platform_seo_settings migration is deployable (US-013)", () => {
  it("ships as a timestamped directory, not a loose .sql", () => {
    expect(migrationDir()).toMatch(/^\d{14}_add_platform_seo_settings$/);

    // `migrate deploy` never reads these, so one here would never run.
    const loose = readdirSync(migrationsDir, { withFileTypes: true }).filter(
      (e) => e.isFile() && e.name.includes("platform_seo_settings"),
    );
    expect(loose.map((e) => e.name)).toEqual([]);
  });

  it("sorts after the migration that precedes it", () => {
    // `migrate deploy` applies directories in lexicographic order, so what has
    // to hold is this migration's POSITION relative to the history it was
    // written against — not that it is the newest one in the tree, which every
    // subsequent migration would falsify (US-019's did).
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const index = dirs.indexOf(migrationDir());

    expect(index).toBeGreaterThan(0);
    expect(dirs[index - 1]).toBe("20260816010000_seed_sample_platform_posts");
  });

  it("creates the table and its unique index, with no FK", () => {
    const sql = migrationSql();

    expect(sql).toContain('CREATE TABLE "platform_seo_settings"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "platform_seo_settings_routePath_key"',
    );
    expect(sql).not.toMatch(/FOREIGN KEY/);
    expect(sql).not.toMatch(/"tenantId"/);
  });
});

describe("platform_seo_settings seed (US-013)", () => {
  it("gives every static marketing route a row", () => {
    const sql = migrationSql();
    for (const route of SEEDED_ROUTES) {
      expect(sql).toContain(`'${route}',`);
    }
  });

  it("leaves no seeded route without the platform default OG image", () => {
    const values = migrationSql()
      .split("VALUES")[1]
      .split("ON CONFLICT")[0]
      .split("\n")
      .filter((line) => line.trim().startsWith("("));

    expect(values).toHaveLength(SEEDED_ROUTES.length);
    for (const line of values) {
      expect(line).toContain(`'${PLATFORM_DEFAULT_OG_IMAGE}'`);
    }
  });

  it("seeds the image as a rooted path, never an absolute URL", () => {
    // platformAbsoluteUrl() resolves it against the origin the container is
    // actually serving, so staging must not advertise production's asset.
    expect(PLATFORM_DEFAULT_OG_IMAGE.startsWith("/")).toBe(true);
    expect(migrationSql()).not.toMatch(/'https?:\/\//);
  });

  it("is idempotent — a replay cannot duplicate or overwrite a route", () => {
    const sql = migrationSql();
    expect(sql).toContain('ON CONFLICT ("routePath") DO NOTHING');
    expect(sql).not.toMatch(/DO UPDATE/);
  });

  it("authors no title or description, so the fallback still governs copy", () => {
    // US-015 keeps app/layout.tsx and each page's own metadata as the source of
    // the text; freezing copy into SQL would make an edit a deploy again.
    const insertColumns = migrationSql()
      .split('INSERT INTO "platform_seo_settings"')[1]
      .split("VALUES")[0];

    expect(insertColumns).toContain('"ogImage"');
    expect(insertColumns).not.toContain('"title"');
    expect(insertColumns).not.toContain('"description"');
  });
});
