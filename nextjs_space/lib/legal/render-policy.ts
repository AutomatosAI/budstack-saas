/**
 * Merge engine for BudStacks-managed legal templates.
 *
 * Templates carry named tokens that are filled from a tenant's legal profile:
 *
 *   {{controllerLegalName}}          required — throws if missing
 *   {{#dpoContact}}...{{/dpoContact}} conditional — the block is dropped when
 *                                     the value is absent or blank
 *
 * A missing REQUIRED token throws rather than rendering an empty string or a
 * literal `{{token}}`. A privacy notice that silently omits the controller's
 * identity is worse than no page at all: it looks authoritative while failing
 * the Art. 13 duty it exists to discharge.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-007).
 */

export class MissingLegalTokenError extends Error {
  readonly tokens: readonly string[];

  constructor(tokens: readonly string[]) {
    super(
      `Legal template is missing required value(s): ${tokens.join(", ")}. ` +
        "Refusing to render an incomplete privacy notice.",
    );
    this.name = "MissingLegalTokenError";
    this.tokens = tokens;
  }
}

export type TemplateValues = Readonly<Record<string, string | null | undefined>>;

const CONDITIONAL = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const TOKEN = /\{\{(\w+)\}\}/g;

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

/** Token names still unresolved after a render pass. */
export function findUnresolvedTokens(rendered: string): string[] {
  return [...new Set(Array.from(rendered.matchAll(TOKEN), (m) => m[1]))];
}

/**
 * Render `template` against `values`.
 *
 * @throws MissingLegalTokenError if any token in `required` is blank, or if any
 *         token survives the merge unresolved.
 */
export function renderTemplate(
  template: string,
  values: TemplateValues,
  required: readonly string[],
): string {
  const missing = required.filter((token) => isBlank(values[token]));
  if (missing.length > 0) {
    throw new MissingLegalTokenError(missing);
  }

  // Conditionals first, so tokens inside a dropped block are never evaluated.
  const withConditionals = template.replace(
    CONDITIONAL,
    (_match, token: string, body: string) => (isBlank(values[token]) ? "" : body),
  );

  const rendered = withConditionals.replace(TOKEN, (match, token: string) => {
    const value = values[token];
    return isBlank(value) ? match : (value as string);
  });

  const unresolved = findUnresolvedTokens(rendered);
  if (unresolved.length > 0) {
    throw new MissingLegalTokenError(unresolved);
  }

  return rendered;
}
