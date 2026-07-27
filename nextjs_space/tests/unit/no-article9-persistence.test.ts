import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractPrismaWriteBlocks,
  findArticle9Assignments,
  findSchemaFieldViolations,
} from "@/scripts/check-article9-persistence.core";
import { ARTICLE_9_FIELDS } from "@/lib/security/article9";
import { SENSITIVE_FIELDS } from "@/lib/security/redact";

/**
 * Article 9 persistence guard — docs/PRDS/prd-data-protection-remediation.md (US-004).
 *
 * BudStacks collects health answers, forwards them to Dr Green from the request
 * body, and stores none of them. The failure mode for that property is silent:
 * the Prisma client is typed as `any` in places, so re-adding a health field to
 * a write payload compiles cleanly. These tests are the real guard.
 */

const APP_ROOT = process.cwd(); // vitest runs from nextjs_space/
const MODEL = "consultation_questionnaires";

function collectSources(dir: string, acc: string[] = []): string[] {
  const SKIP = new Set(["node_modules", ".next", "dist", "coverage", "_archive"]);
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSources(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("classifier", () => {
  it("captures a whole write payload including nested objects", () => {
    const src = `
      await prisma.consultation_questionnaires.create({
        data: { id: x, nested: { a: (1 + 2) }, hasCancerTreatment: body.hasCancerTreatment },
      });
    `;
    const blocks = extractPrismaWriteBlocks(src, MODEL);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("hasCancerTreatment");
  });

  it("flags a health field assigned in a write payload", () => {
    const src = `prisma.consultation_questionnaires.create({ data: { medicalConditions: body.medicalConditions } })`;
    expect(findArticle9Assignments(src, MODEL, ARTICLE_9_FIELDS)).toEqual([
      "medicalConditions",
    ]);
  });

  it("ignores health field names used outside a write payload", () => {
    const src = `
      const payload = { medicalConditions: body.medicalConditions };
      await callDrGreenAPI("/dapp/clients", { body: payload });
      await prisma.consultation_questionnaires.create({ data: { id: x } });
    `;
    expect(findArticle9Assignments(src, MODEL, ARTICLE_9_FIELDS)).toEqual([]);
  });

  it("does not mistake a longer identifier for a health field", () => {
    const src = `prisma.consultation_questionnaires.update({ data: { hasCancerTreatmentFlagArchived: true } })`;
    expect(findArticle9Assignments(src, MODEL, ARTICLE_9_FIELDS)).toEqual([]);
  });

  it("flags a health field declared on the schema model", () => {
    const schema = `model consultation_questionnaires {\n  id String @id\n  hasLiverDisease Boolean\n}\n`;
    expect(findSchemaFieldViolations(schema, MODEL, ARTICLE_9_FIELDS)).toEqual([
      "hasLiverDisease",
    ]);
  });

  it("passes a schema model with no health fields", () => {
    const schema = `model consultation_questionnaires {\n  id String @id\n  email String\n}\n`;
    expect(findSchemaFieldViolations(schema, MODEL, ARTICLE_9_FIELDS)).toEqual([]);
  });
});

describe("the real tree holds no Article 9 data", () => {
  it("declares no health field on the questionnaire model", () => {
    const schema = readFileSync(join(APP_ROOT, "prisma", "schema.prisma"), "utf8");
    const offenders = findSchemaFieldViolations(schema, MODEL, ARTICLE_9_FIELDS);

    expect(
      offenders,
      `Article 9 fields re-added to the schema: ${offenders.join(", ")}. ` +
        "BudStacks must not store special-category health data.",
    ).toEqual([]);
  });

  it("writes no health field to the database anywhere in app/ or lib/", () => {
    const offenders: string[] = [];

    const files = [
      ...collectSources(join(APP_ROOT, "app")),
      ...collectSources(join(APP_ROOT, "lib")),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes(MODEL)) continue;

      for (const field of findArticle9Assignments(source, MODEL, ARTICLE_9_FIELDS)) {
        offenders.push(`${relative(APP_ROOT, file)} → ${field}`);
      }
    }

    expect(
      offenders,
      `Article 9 fields written to the database:\n${offenders.join("\n")}\n` +
        "Forward these to Dr Green from the request body instead of persisting them.",
    ).toEqual([]);
  });

  it("still finds the consultation submit route, so the scan is not vacuous", () => {
    // If the route moves or the Prisma call is renamed, the scan above would go
    // green by finding nothing at all. Pin that it is still looking at something.
    const submitRoute = readFileSync(
      join(APP_ROOT, "app", "api", "consultation", "submit", "route.ts"),
      "utf8",
    );
    expect(extractPrismaWriteBlocks(submitRoute, MODEL).length).toBeGreaterThan(0);
  });
});

describe("drift guards", () => {
  it("covers every Article 9 field in the log redactor", () => {
    const unredacted = ARTICLE_9_FIELDS.filter((f) => !SENSITIVE_FIELDS.has(f));

    expect(
      unredacted,
      `Health fields missing from SENSITIVE_FIELDS: ${unredacted.join(", ")}. ` +
        "redact.ts should spread ARTICLE_9_FIELDS so the two cannot drift.",
    ).toEqual([]);
  });

  it("freezes the field list against mutation", () => {
    expect(Object.isFrozen(ARTICLE_9_FIELDS)).toBe(true);
  });

  it("lists the 15 columns the migration drops", () => {
    expect(ARTICLE_9_FIELDS).toHaveLength(15);
  });
});
