/**
 * Upgrade CTA copy and destination — one source for every locked surface.
 *
 * SEO Supercharge US-013. The price appears in a locked card, on the upgrade
 * page, and (later) in whatever else Workstream C locks; having it in three
 * string literals is how a price change ships half-applied. There is no
 * checkout: `UPGRADE_PATH` is a static in-app page that explains Pro and hands
 * the tenant to the existing public contact form. Billing is PRD-303's problem
 * and slots in by changing this constant.
 *
 * Pure module — no I/O, no React. Imported by both server and client
 * components, so it must stay dependency-free.
 */

/** Basic — what a locked tenant is on today. */
export const BASIC_PLAN_PRICE_LABEL = "$99/mo";

/** Pro — what the CTA is selling. */
export const PRO_PLAN_PRICE_LABEL = "$169/mo";

/**
 * The exact CTA string, em dash included. Asserted in tests: the PRD specifies
 * this copy verbatim ("CTA copy names the price"), so a silent reword is a
 * regression, not a tweak.
 */
export const UPGRADE_CTA_LABEL = `Upgrade to Pro — ${PRO_PLAN_PRICE_LABEL}`;

/** The static upgrade page. In-app and relative — never an external checkout. */
export const UPGRADE_PATH = "/tenant-admin/upgrade";

/**
 * Where the upgrade page sends someone who wants to actually buy: the existing
 * public contact form (`app/contact/page.tsx`, allow-listed in middleware.ts as
 * a public route, so it resolves for a signed-in admin without a redirect).
 */
export const UPGRADE_CONTACT_PATH = "/contact";
