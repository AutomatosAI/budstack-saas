/**
 * Article 9 persistence gate — pure classifier.
 *
 * BudStacks forwards special-category health answers to Dr Green from the
 * in-memory request body and stores none of them. This module detects breaches
 * of that property in two places: Prisma write payloads in application source,
 * and field declarations in the Prisma schema.
 *
 * Pure (no fs, no DB) so it can be unit-tested against inline fixtures; the
 * caller supplies the source text. Mirrors the structure of
 * `check-auth-wrappers.core.ts`.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-004).
 */

/** Prisma write methods that can carry a data payload. */
const WRITE_METHODS = ["create", "createMany", "update", "updateMany", "upsert"] as const;

/**
 * Extract the full argument text of every Prisma write against `model`.
 *
 * Bracket-matches from the call site so nested objects, arrays and parenthesised
 * expressions inside the payload are captured whole — a line-based or lazy regex
 * approach would stop at the first `)` and miss later fields.
 */
export function extractPrismaWriteBlocks(source: string, model: string): string[] {
  const pattern = new RegExp(
    `prisma\\.${model}\\.(${WRITE_METHODS.join("|")})\\s*\\(`,
    "g",
  );
  const blocks: string[] = [];

  for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;

    for (let i = open; i < source.length; i++) {
      const char = source[i];
      if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth === 0) {
          blocks.push(source.slice(open, i + 1));
          break;
        }
      }
    }
  }

  return blocks;
}

/**
 * Field names from `fields` that are assigned as object keys inside a Prisma
 * write against `model`. Empty array means the source is clean.
 */
export function findArticle9Assignments(
  source: string,
  model: string,
  fields: readonly string[],
): string[] {
  const found = new Set<string>();

  for (const block of extractPrismaWriteBlocks(source, model)) {
    for (const field of fields) {
      // `field:` preceded by a brace, comma or whitespace — an object key in the
      // payload, rather than a substring of a longer identifier.
      if (new RegExp(`(^|[{,\\s])${field}\\s*:`).test(block)) {
        found.add(field);
      }
    }
  }

  return [...found];
}

/**
 * Field names from `fields` declared on `model` in a Prisma schema. Catches
 * reintroduction at the schema layer, which the source scan alone would miss.
 */
export function findSchemaFieldViolations(
  schemaSource: string,
  model: string,
  fields: readonly string[],
): string[] {
  const block = schemaSource.match(
    new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`),
  );
  if (!block) return [];

  return fields.filter((field) =>
    new RegExp(`^\\s*${field}\\s+\\S`, "m").test(block[0]),
  );
}
