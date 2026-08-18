/**
 * US-010 — server-side rendering of the branded email shell.
 *
 * `renderEmailBody` is the single place an authored message body becomes a
 * complete email document: it resolves the tenant's logo into a URL an inbox
 * can actually fetch, reads the postal address the footer is required to carry,
 * and decides whether this message gets an unsubscribe line at all.
 *
 * IT DOES NOT SANITIZE. The save pipeline (US-011) is render -> inline CSS ->
 * `sanitizeEmailHtml` LAST, because inlining after sanitizing would reintroduce
 * unchecked style attributes. Callers own that final step; nothing in this
 * module may be sent as-is.
 *
 * Server-only: pulls in react-email. The pure URL and address logic is
 * exported separately so it can be tested and reused without rendering.
 */

import { render } from "@react-email/components";
import EmailShell from "@/emails/email-shell";
import { absoluteEmailImageUrl } from "@/lib/email/email-asset-url";
import {
  DEFAULT_EMAIL_CATEGORY,
  type EmailCategory,
} from "@/lib/email/suppression";
import { parseTenantSettings } from "@/lib/tenant/tenant-settings";
import { getTenantBaseUrl, type TenantUrlData } from "@/lib/tenant/tenant-utils";

/**
 * The Handlebars placeholder the footer emits when the caller has no resolved
 * unsubscribe link yet — a per-recipient token only exists once fan-out picks a
 * recipient (US-019). Left as a literal it flows through the queue untouched
 * and is filled by the SAME `Handlebars.compile(contentHtml)` the worker
 * already runs (scripts/email-worker.ts). Nothing about that contract changes
 * here; this is a value that survives it.
 */
export const UNSUBSCRIBE_URL_SLOT = "{{unsubscribeUrl}}";

/**
 * Everything the shell needs about a tenant. Widened from `TenantUrlData`
 * (which decides the base URL) with the branding and postal-address fields the
 * header and footer read. All of them are optional because a tenant that has
 * filled in none of them still has to get a valid email.
 */
export interface EmailShellTenant extends TenantUrlData {
  readonly businessName: string;
  /** For the redacted parse-failure signal only. */
  readonly id?: string;
  /** Raw `tenants.settings` Json — read through `parseTenantSettings`. */
  readonly settings?: unknown;
  /** `tenant_branding.logoUrl`, which stores an S3 key, not a URL. */
  readonly logoUrl?: string | null;
  readonly primaryColor?: string | null;
  readonly businessAddress1?: string | null;
  readonly businessAddress2?: string | null;
  readonly businessCity?: string | null;
  readonly businessState?: string | null;
  readonly businessPostalCode?: string | null;
  readonly businessCountry?: string | null;
}

export interface RenderEmailBodyOptions {
  /**
   * Absence means transactional — the same tolerance rule the queue payload
   * uses (lib/email/suppression.ts). Only `marketing` gets an unsubscribe line:
   * offering to opt out of an order receipt is a bug, not compliance.
   */
  readonly category?: EmailCategory;
  /**
   * A resolved, recipient-specific unsubscribe link. Omit it and the footer
   * carries {@link UNSUBSCRIBE_URL_SLOT} instead.
   */
  readonly unsubscribeUrl?: string | null;
  /**
   * PREVIEW ONLY — resolve the logo against this origin instead of the
   * tenant's own base URL. The preview pane's iframe is `srcDoc`, so it
   * inherits the ADMIN page's CSP, whose img-src carries no tenant domains —
   * assets must resolve against the origin the author is actually on to load
   * there. Never set on a send or save path: a mailed shell must carry the
   * tenant's own host.
   */
  readonly baseUrlOverride?: string;
}

/** Postal columns, in the order they are joined into one footer line. */
const POSTAL_FIELDS = [
  "businessAddress1",
  "businessAddress2",
  "businessCity",
  "businessState",
  "businessPostalCode",
  "businessCountry",
] as const;

/**
 * The postal address the footer prints.
 *
 * `settings.businessAddress` is the authoritative value — one free-text line an
 * operator can set to exactly what their jurisdiction requires, including a
 * registered office that is not the trading address in the columns. It falls
 * back to the `tenants` postal columns the profile form already writes, so a
 * tenant that filled that form gets a correct footer without touching JSON.
 *
 * Returns null rather than an empty string when there is nothing to print: the
 * footer omits the line entirely instead of rendering a blank one.
 */
export function resolveBusinessAddress(
  tenant: EmailShellTenant,
): string | null {
  const settings = parseTenantSettings(tenant.settings, { tenantId: tenant.id });
  const configured = settings.businessAddress?.trim();
  if (configured) return configured;

  const parts = POSTAL_FIELDS.map((field) => tenant[field]?.trim()).filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/** The unsubscribe href for this message, or null when it must not appear. */
function resolveUnsubscribeUrl(
  category: EmailCategory,
  provided: string | null | undefined,
): string | null {
  if (category !== "marketing") return null;
  return provided?.trim() || UNSUBSCRIBE_URL_SLOT;
}

/**
 * Wrap an authored message body in the tenant's branded shell and return the
 * full HTML document. See the module note: the result is NOT sanitized.
 */
export async function renderEmailBody(
  bodyHtml: string,
  tenant: EmailShellTenant,
  options: RenderEmailBodyOptions = {},
): Promise<string> {
  const baseUrl = options.baseUrlOverride ?? getTenantBaseUrl(tenant);
  const category = options.category ?? DEFAULT_EMAIL_CATEGORY;

  return render(
    EmailShell({
      businessName: tenant.businessName,
      bodyHtml,
      logoUrl: absoluteEmailImageUrl(tenant.logoUrl, baseUrl),
      primaryColor: tenant.primaryColor,
      businessAddress: resolveBusinessAddress(tenant),
      unsubscribeUrl: resolveUnsubscribeUrl(category, options.unsubscribeUrl),
    }),
  );
}
