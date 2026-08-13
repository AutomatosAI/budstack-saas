/**
 * templateName values the platform enqueues for its own purposes.
 *
 * The worker's dynamic-override lookup keys on `templateName`
 * (scripts/email-worker.ts), so an email_event_mappings row carrying one of
 * these would silently swap the platform's own rendered HTML for whatever
 * template the row points at. For "test-send" that means an admin's test send
 * delivering some other template's content — platform-wide, if the mapping is a
 * system default. The mapping routes reject these names so the invariant is
 * enforced rather than assumed.
 */
export const TEST_SEND_TEMPLATE_NAME = "test-send";

/**
 * US-019 — every campaign fan-out job. Reserved for the same reason: a mapping
 * on this name would swap the campaign the author wrote and approved for some
 * other template, for the whole list at once.
 */
export const CAMPAIGN_TEMPLATE_NAME = "campaign";

export const RESERVED_EVENT_TYPES: readonly string[] = [
  TEST_SEND_TEMPLATE_NAME,
  CAMPAIGN_TEMPLATE_NAME,
];

export const RESERVED_EVENT_TYPE_MESSAGE =
  "That event type is reserved by the platform";

/** Case/whitespace-insensitive: stricter than the worker's exact match, on purpose. */
export function isReservedEventType(eventType: string): boolean {
  return RESERVED_EVENT_TYPES.includes(eventType.trim().toLowerCase());
}
