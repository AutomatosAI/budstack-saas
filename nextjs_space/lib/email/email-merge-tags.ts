/**
 * US-013 — the ONE catalogue of merge tags an author may insert into an email.
 *
 * Before this module the list lived inline in the admin editor (COMMON_VARIABLES
 * in `components/admin/email/EmailHtmlPane.tsx`, lifted there from
 * `EmailEditor.tsx`), so the visual composer had nothing to offer and the HTML
 * pane's list could drift from the values a send actually carries. Both editors
 * now read this module.
 *
 * ONE SOURCE, TWO HALVES. This module owns which tags EXIST and what an author
 * calls them; `lib/email/sample-variables.ts` (US-006) owns what each one is
 * worth in a test send. They are keyed by the same event type and pinned to each
 * other by `tests/unit/email-merge-tags.test.ts`, which fails if a tag offered
 * here has no sample value — the failure mode being a test send that arrives
 * with a raw `{{tag}}` in it.
 *
 * Isomorphic — no server-only imports. `lib/email/email-merge-tag-node.ts` pulls
 * it into the browser bundle for the composer AND into the route handler that
 * runs the save pipeline.
 */

export interface EmailMergeTag {
  /** The Handlebars variable the worker fills, e.g. `userName`. */
  readonly name: string;
  /** What the author reads in the menu and on the chip, e.g. "Customer name". */
  readonly label: string;
}

export interface EmailMergeTagGroup {
  readonly category: string;
  readonly tags: readonly EmailMergeTag[];
}

/**
 * The tags every event carries, mirroring `baseSampleVariables()`.
 *
 * `items` is a list rather than a value: on its own it renders as an array, and
 * it is here because a `{{#each items}}` block needs it. It was on the pre-US-013
 * list for the same reason and is kept so nothing an HTML author already used
 * disappears.
 */
const GLOBAL_TAGS: readonly EmailMergeTag[] = [
  { name: "businessName", label: "Business name" },
  { name: "subdomain", label: "Store address" },
  { name: "loginUrl", label: "Sign-in link" },
  { name: "logoUrl", label: "Logo image address" },
  { name: "primaryColor", label: "Brand colour" },
];

const RECIPIENT_TAGS: readonly EmailMergeTag[] = [
  { name: "userName", label: "Customer name" },
  { name: "email", label: "Customer email" },
  { name: "resetLink", label: "Password reset link" },
];

const ORDER_TAGS: readonly EmailMergeTag[] = [
  { name: "orderNumber", label: "Order number" },
  { name: "total", label: "Order total" },
  { name: "shippingAddress", label: "Shipping address" },
  { name: "items", label: "Order items (list)" },
];

const BASE_GROUPS: readonly EmailMergeTagGroup[] = [
  { category: "Global", tags: GLOBAL_TAGS },
  { category: "Customer", tags: RECIPIENT_TAGS },
  { category: "Order", tags: ORDER_TAGS },
];

/** The heading the per-event extras appear under. */
export const EVENT_MERGE_TAG_CATEGORY = "This email";

/**
 * Extras a single event adds, keyed by the event type an
 * `email_event_mappings` row carries — the same keys as `eventSampleVariables()`.
 *
 * Only EXTRAS: a template mapped to nothing still gets every base group, because
 * an author routinely writes the email before anyone maps it to an event.
 */
const EVENT_TAGS: Readonly<Record<string, readonly EmailMergeTag[]>> = {
  tenantWelcome: [
    { name: "adminName", label: "Admin name" },
  ],
  "order-status-update": [
    { name: "status", label: "Order status" },
    { name: "trackingUrl", label: "Tracking link" },
  ],
  "kyc-link": [{ name: "kycLink", label: "ID check link" }],
  "kyc-status": [
    { name: "status", label: "ID check status" },
    { name: "rejectionReason", label: "Reason for rejection" },
  ],
  "client-status": [
    { name: "status", label: "Account status" },
    { name: "rejectionReason", label: "Reason for rejection" },
  ],
  teamInvite: [
    { name: "inviterName", label: "Who invited them" },
    { name: "role", label: "Role offered" },
    { name: "inviteUrl", label: "Invitation link" },
  ],
  newsletterConfirm: [
    { name: "confirmUrl", label: "Confirm-subscription link" },
  ],
  "subprocessor-change": [
    { name: "subprocessorName", label: "Subprocessor name" },
    { name: "effectiveDate", label: "Effective date" },
  ],
};

/**
 * Handlebars snippets that are NOT merge tags: block helpers and expressions
 * that take arguments.
 *
 * Reference-only, and offered by the HTML pane alone. None of them can become a
 * chip — a chip is one self-contained `{{tag}}`, whereas `{{#each items}}` is
 * half of a pair and would leave an unclosed block behind in the visual editor.
 */
export const EMAIL_TEMPLATE_HELPERS: readonly string[] = [
  "#each items",
  "/each",
  "toFixed price",
  "multiply price quantity",
];

/** Header the helper snippets are listed under in the HTML pane. */
export const EMAIL_TEMPLATE_HELPERS_CATEGORY = "Helpers";

/**
 * The tags on offer for one event: every base group, plus that event's extras.
 * An unknown or absent event type gets the base groups — the same rule
 * `sampleVariablesForEvent` applies to its values.
 */
export function mergeTagGroupsForEvent(
  eventType?: string | null,
): readonly EmailMergeTagGroup[] {
  const extras = eventType ? EVENT_TAGS[eventType] : undefined;
  if (!extras || extras.length === 0) return BASE_GROUPS;
  return [...BASE_GROUPS, { category: EVENT_MERGE_TAG_CATEGORY, tags: extras }];
}

/** Every tag this module knows about, whatever event it belongs to. */
const ALL_TAGS: readonly EmailMergeTag[] = [
  ...BASE_GROUPS.flatMap((group) => group.tags),
  ...Object.values(EVENT_TAGS).flat(),
];

/**
 * What a name may look like.
 *
 * SECURITY, not tidiness. Whatever comes out of this ends up wrapped in `{{ }}`
 * inside `contentHtml`, which `scripts/email-worker.ts` later hands to
 * `Handlebars.compile`. Letters, digits, `_` and `.` cannot express anything but
 * a property path: no spaces means no helper invocation with arguments, no `#`
 * or `/` means no block, and no braces means the wrapper cannot be closed early
 * to reach a triple-stache (`{{{x}}}` prints unescaped HTML). The document is
 * untrusted — it arrives in a request body — so the check runs on the way out,
 * not only in the menu that produced it.
 */
export const EMAIL_MERGE_TAG_NAME_PATTERN =
  "[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*";

const MERGE_TAG_NAME = new RegExp(`^${EMAIL_MERGE_TAG_NAME_PATTERN}$`);

/** Longer than every tag above, short enough to keep a chip readable. */
export const EMAIL_MERGE_TAG_MAX_LENGTH = 64;

/**
 * Narrow anything an author typed to a usable tag name, or null.
 *
 * Accepts the tag with or without its braces, because an author copying from the
 * reference pastes `{{orderNumber}}` and an author reading the docs types
 * `orderNumber`. Both mean the same thing and neither should be an error.
 */
export function normaliseMergeTagName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const unwrapped = raw.trim().replace(/^\{\{+/, "").replace(/\}\}+$/, "").trim();
  if (!unwrapped || unwrapped.length > EMAIL_MERGE_TAG_MAX_LENGTH) return null;

  return MERGE_TAG_NAME.test(unwrapped) ? unwrapped : null;
}

/** The literal text a tag becomes in the sent message. */
export function mergeTagText(name: string): string {
  return `{{${name}}}`;
}

/**
 * What the chip reads. A custom tag has no label of its own, so it wears its own
 * name — better than "Unknown", which tells the author nothing about what they
 * typed.
 */
export function mergeTagLabel(name: string): string {
  return ALL_TAGS.find((tag) => tag.name === name)?.label ?? name;
}

/** Whether a name is one this module offers, as opposed to a custom one. */
export function isKnownMergeTag(name: string): boolean {
  return ALL_TAGS.some((tag) => tag.name === name);
}

/**
 * Every event that adds extras, so the coverage test can walk all of them
 * against `sampleVariablesForEvent` rather than a hand-copied list.
 */
export const EMAIL_MERGE_TAG_EVENT_TYPES: readonly string[] =
  Object.keys(EVENT_TAGS);
