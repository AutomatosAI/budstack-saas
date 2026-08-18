import { NextResponse } from "next/server";

import { withSuperAdmin } from "@/lib/api-auth";
import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  PLATFORM_SEO_BODY_MAX_BYTES,
  PLATFORM_SEO_SETTING_SELECT,
  platformSeoSettingSchema,
  platformSeoValidationMessage,
  storedSeoText,
  type PlatformSeoSettingRow,
} from "@/lib/platform/seo-settings";
import { requireSameOrigin } from "@/lib/security/require-same-origin";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * budstacks.io's own per-route metadata (US-014).
 *
 * SUPER-ADMIN ONLY, like `/api/platform/posts` and `/api/platform/upload`. The
 * fourth route under `app/api/platform/`, `leads`, is deliberately
 * unauthenticated — a prospect filling in the homepage CTA has no account — and
 * it is NOT the model here: copying its shape would let anyone on the internet
 * rewrite the title Google shows for the front page.
 *
 * ONE VERB. The rows are an authored override of an EXISTING page's metadata,
 * so there is nothing to create and nothing to delete: the route list is fixed
 * in code (`lib/platform/seo-routes.ts`) and clearing every field is what
 * returns a route to its fallback. `upsert` is what makes the first save on a
 * guide — which the US-013 seed deliberately left rowless — the same request as
 * the tenth save on the homepage.
 *
 * `platform_seo_settings` is deliberately absent from `tenantScopedModels`
 * (lib/db.ts). That Set is an OPT-IN allowlist; joining it would weld a tenantId
 * filter onto this upsert and onto every read US-015 makes.
 */

const ROUTE_PUT = "PUT /api/platform/seo";

/** PUT — store the metadata for one route. Replaces every authored field. */
export const PUT = withSuperAdmin(async (req) => {
  const originError = requireSameOrigin(req);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await parseJsonBody(req, undefined, {
      maxBytes: PLATFORM_SEO_BODY_MAX_BYTES,
    });
  } catch (error) {
    return apiError(error, { route: ROUTE_PUT });
  }

  const parsed = platformSeoSettingSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(
      platformSeoValidationMessage(parsed.error),
      ROUTE_PUT,
    );
  }
  const input = parsed.data;

  // Empty is stored as NULL, never "": US-015 falls back per COLUMN, and a
  // stored empty string would override a real title with nothing at all.
  const authored = {
    title: storedSeoText(input.title),
    description: storedSeoText(input.description),
    ogImage: storedSeoText(input.ogImage),
    // Defaulted rather than preserved, for the same reason the column defaults
    // false: an absent key must never be the thing that drops a marketing page
    // out of the index.
    noindex: input.noindex ?? false,
  };

  try {
    const setting: PlatformSeoSettingRow =
      await prisma.platform_seo_settings.upsert({
        // Single-field unique on a model that is not tenant-scoped, so this is
        // a plain `findUnique`-shaped predicate — the compound-unique problem
        // the $extends rewrite causes on tenant models does not arise here.
        where: { routePath: input.routePath },
        create: { routePath: input.routePath, ...authored },
        update: authored,
        select: PLATFORM_SEO_SETTING_SELECT,
      });

    return NextResponse.json({ setting });
  } catch (error) {
    return apiError(error, { route: ROUTE_PUT });
  }
});
