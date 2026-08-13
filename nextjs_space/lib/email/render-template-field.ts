/**
 * US-006 / US-015 — one request-path Handlebars render, with the cost bound
 * both of its callers need.
 *
 * Lifted out of `lib/email/test-send.ts` when the preview gave the same job a
 * second caller. The worker absorbs a pathological template inside its own
 * process; a request cannot, so anything rendering on this path caps block
 * depth first and turns a template the author broke into their 400 rather than
 * an operator's 500.
 *
 * Not a second template system: this is the SAME `Handlebars.compile` the
 * worker runs (`lib/email/handlebars-helpers.ts`), against the same helper set,
 * so what a test send or a preview shows is what the worker would produce.
 */

import { ApiError } from "@/lib/api-error";
import {
  maxBlockDepth,
  renderEmailTemplate,
} from "@/lib/email/handlebars-helpers";

/**
 * Deeper than any real email layout, shallow enough that the exponential
 * blow-up stays bounded on the request path.
 */
export const MAX_TEMPLATE_BLOCK_DEPTH = 10;

/**
 * Render one field with the supplied variables, refusing pathological or
 * malformed templates as 400s. The caller authored this template, so echoing
 * the Handlebars parse error back is useful rather than a leak — capped,
 * because it quotes their own source.
 */
export function renderTemplateField(
  source: string,
  variables: Record<string, unknown>,
): string {
  if (maxBlockDepth(source) > MAX_TEMPLATE_BLOCK_DEPTH) {
    throw new ApiError(
      `This email nests {{#…}} blocks more than ${MAX_TEMPLATE_BLOCK_DEPTH} deep — simplify it and try again.`,
      400,
    );
  }

  try {
    return renderEmailTemplate(source, variables);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new ApiError(
      `This email could not be rendered — ${detail.slice(0, 200)}`,
      400,
    );
  }
}
