import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  PLATFORM_LEAD_SOURCES,
  recordPlatformLead,
} from "@/lib/leads/platform-leads";
import {
  PLATFORM_LEAD_MAX_REQUESTS,
  PLATFORM_LEAD_WINDOW_MS,
  OPERATOR_101_PDF_PATH,
} from "@/lib/constants";

const ROUTE = "POST /api/platform/leads";

/**
 * Public lead capture for budstacks.io (homepage CTA, Operator 101 download).
 *
 * Unauthenticated and platform-level — there is no tenant here by design, which
 * is the whole reason this is not the storefront newsletter endpoint.
 */
const leadSchema = z.object({
  // Trimmed + lower-cased before validating: the stored address is the dedupe
  // key on a unique index, and Postgres compares case-sensitively.
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(PLATFORM_LEAD_SOURCES),
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  country: z.string().trim().max(80).optional(),
  // GDPR: the visitor must actively tick. A missing or false value is rejected
  // rather than silently defaulted — the consent record has to mean something.
  consent: z.literal(true),
  // Honeypot. Real users never see this field, so anything in it is a bot.
  website: z.string().max(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateLimitResult = await checkRateLimit(`platform-lead:${ip}`, {
      maxRequests: PLATFORM_LEAD_MAX_REQUESTS,
      windowMs: PLATFORM_LEAD_WINDOW_MS,
    });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const parsed = leadSchema.safeParse(await request.json());
    if (!parsed.success) {
      const onEmail = parsed.error.issues.some((i) => i.path[0] === "email");
      const onConsent = parsed.error.issues.some((i) => i.path[0] === "consent");
      return apiValidationError(
        onEmail
          ? "Please enter a valid email address."
          : onConsent
            ? "Please tick the box to continue."
            : "Invalid request.",
        ROUTE,
      );
    }

    const { email, source, name, company, country, website } = parsed.data;

    // Honeypot tripped — answer exactly as we would a real signup so the bot
    // learns nothing, but record nothing.
    if (website) {
      return NextResponse.json({ success: true, download: OPERATOR_101_PDF_PATH });
    }

    await recordPlatformLead({ email, source, name, company, country });

    // Same response whether the address is new or already on the list: a
    // differing reply would turn this into a lead-enumeration oracle.
    return NextResponse.json({ success: true, download: OPERATOR_101_PDF_PATH });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
}
