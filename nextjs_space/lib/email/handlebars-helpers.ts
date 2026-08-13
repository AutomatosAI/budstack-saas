import Handlebars from "handlebars";

/**
 * The Handlebars helper set the email worker registers before it compiles a
 * mapped template (scripts/email-worker.ts). Extracted so the request path can
 * render a template exactly the way the worker will — one definition, two
 * callers. Changing a helper here changes it for both; that is the point.
 */
export function registerEmailHelpers(env: typeof Handlebars): typeof Handlebars {
  env.registerHelper("multiply", (a: unknown, b: unknown) =>
    (Number(a) * Number(b)).toFixed(2),
  );
  env.registerHelper("toFixed", (num: unknown) => Number(num).toFixed(2));
  return env;
}

/**
 * Isolated environment for request-path renders. `Handlebars.create()` keeps a
 * route from mutating the process-global Handlebars environment other callers
 * (and the worker, in its own process) compile with.
 */
const emailHandlebars = registerEmailHelpers(Handlebars.create());

/**
 * Compile and run one email template string with the worker's helper set.
 * A malformed template throws — callers decide how to surface that rather than
 * queueing a half-rendered email.
 */
export function renderEmailTemplate(
  source: string,
  variables: Record<string, unknown> = {},
): string {
  return emailHandlebars.compile(source)(variables);
}

/**
 * Deepest `{{#…}}` block nesting in a template.
 *
 * Output size is exponential in this number — self-nested `{{#each}}` blocks
 * over a multi-row collection double the work per level, so a few hundred bytes
 * of template can exhaust memory. The worker absorbs that in its own process;
 * a request-path render cannot, so callers on that path cap it.
 */
export function maxBlockDepth(source: string): number {
  let depth = 0;
  let deepest = 0;

  for (const token of source.match(/\{\{~?[#/]/g) ?? []) {
    if (token.endsWith("#")) {
      depth += 1;
      deepest = Math.max(deepest, depth);
    } else {
      depth = Math.max(0, depth - 1);
    }
  }

  return deepest;
}
