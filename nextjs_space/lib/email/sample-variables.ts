/**
 * US-006 — canned sample data for test sends.
 *
 * Seeded from the variable reference the editor shows authors plus the props
 * each react-email template is rendered with, so a test send exercises the
 * placeholders an author can actually reference. Nothing here is tenant-specific:
 * the caller passes the live business name / recipient as overrides.
 *
 * THE OTHER HALF OF ONE SOURCE. `lib/email/email-merge-tags.ts` (US-013) owns
 * which tags exist and what an author calls them; this module owns what each one
 * is worth in a test send. Both are keyed by the same event type, and
 * `tests/unit/email-merge-tags.test.ts` fails if a tag offered there has no
 * sample value here — a test send arriving with a raw `{{tag}}` in it being
 * exactly the drift that pairing prevents. Adding a tag means adding both.
 */

const APP_URL_FALLBACK = "http://localhost:3000";

const SAMPLE_BUSINESS_NAME = "Sample Store";
const SAMPLE_SUBDOMAIN = "sample-store";
const SAMPLE_PRIMARY_COLOR = "#16a34a";
const SAMPLE_CUSTOMER_NAME = "Sample Customer";
const SAMPLE_CUSTOMER_EMAIL = "customer@example.com";
const SAMPLE_ORDER_NUMBER = "ORD-10432";
const SAMPLE_SHIPPING_ADDRESS = "1 Sample Street, Dublin, D01 X4X4, IE";

/** Two lines so `{{#each items}}`, `toFixed` and `multiply` all have real work. */
const SAMPLE_ITEMS = [
  { name: "Sample Flower 10g", quantity: 2, price: 24.5, sku: "SMPL-001" },
  { name: "Sample Oil 30ml", quantity: 1, price: 39.99, sku: "SMPL-002" },
];

const SAMPLE_ORDER_TOTAL = 88.99;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || APP_URL_FALLBACK;
}

/** Variables every event can reference, whatever template is mapped to it. */
function baseSampleVariables(): Record<string, unknown> {
  const base = appUrl();
  return {
    // Global
    businessName: SAMPLE_BUSINESS_NAME,
    tenantName: SAMPLE_BUSINESS_NAME,
    subdomain: SAMPLE_SUBDOMAIN,
    loginUrl: `${base}/auth/signin`,
    logoUrl: `${base}/logo.png`,
    primaryColor: SAMPLE_PRIMARY_COLOR,
    // User
    userName: SAMPLE_CUSTOMER_NAME,
    name: SAMPLE_CUSTOMER_NAME,
    email: SAMPLE_CUSTOMER_EMAIL,
    resetLink: `${base}/auth/reset-password/sample-token`,
    link: base,
    // Order
    orderNumber: SAMPLE_ORDER_NUMBER,
    total: SAMPLE_ORDER_TOTAL,
    shippingAddress: SAMPLE_SHIPPING_ADDRESS,
    items: SAMPLE_ITEMS,
  };
}

/**
 * Per-event extras, keyed by the `templateName` each send site enqueues (the
 * same string an email_event_mappings row carries as `eventType`).
 */
function eventSampleVariables(base: string): Record<string, Record<string, unknown>> {
  return {
    welcome: { loginUrl: `${base}/auth/signin` },
    passwordReset: { resetLink: `${base}/auth/reset-password/sample-token` },
    tenantWelcome: { adminName: "Sample Admin", subdomain: SAMPLE_SUBDOMAIN },
    orderConfirmation: { items: SAMPLE_ITEMS, total: SAMPLE_ORDER_TOTAL },
    "order-status-update": {
      status: "SHIPPED",
      trackingUrl: `${base}/orders/${SAMPLE_ORDER_NUMBER}/tracking`,
    },
    "kyc-link": { kycLink: `${base}/kyc/sample-token` },
    "kyc-status": { status: "approved", rejectionReason: "" },
    "client-status": { status: "approved", rejectionReason: "" },
    teamInvite: {
      inviterName: "Sample Admin",
      role: "MANAGER",
      inviteUrl: `${base}/team/accept-invite?token=sample-token`,
    },
    newsletterConfirm: { confirmUrl: `${base}/newsletter/confirm?token=sample-token` },
    "subprocessor-change": {
      subprocessorName: "Sample Processor Ltd",
      effectiveDate: "1 January 2026",
    },
  };
}

export interface SampleVariableOverrides {
  /** Live tenant name, so the test reads like the real thing. */
  businessName?: string | null;
  /** The admin the test is addressed to. */
  email?: string | null;
}

/**
 * Sample variable set for one event type, with live values layered on top.
 * An unknown/absent event type still gets the base set — a template mapped to
 * nothing must still render something recognisable.
 */
export function sampleVariablesForEvent(
  eventType?: string | null,
  overrides: SampleVariableOverrides = {},
): Record<string, unknown> {
  const perEvent = eventType ? eventSampleVariables(appUrl())[eventType] : undefined;

  return {
    ...baseSampleVariables(),
    ...(perEvent ?? {}),
    ...(overrides.businessName
      ? { businessName: overrides.businessName, tenantName: overrides.businessName }
      : {}),
    ...(overrides.email ? { email: overrides.email } : {}),
  };
}
