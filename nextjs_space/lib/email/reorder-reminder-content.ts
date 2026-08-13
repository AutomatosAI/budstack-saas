/**
 * US-028 — what a reorder reminder actually says, and the variables that fill it.
 *
 * SERVER ONLY (the render pipeline pulls in react-email and juice).
 *
 * TWO RENDERS, because the message exists at two levels:
 *
 *   - {@link renderReorderReminderHtml} builds the TENANT-BRANDED body the sweep
 *     puts in the queue payload. It carries the store's logo and its postal
 *     address, and it is what goes out when the store has mapped no template of
 *     their own.
 *   - {@link renderReorderReminderSystemHtml} builds the SEEDED system default
 *     (`scripts/seed-reorder-template.ts`). It belongs to no tenant, so its
 *     chrome carries Handlebars slots where a store's name and address go — the
 *     same device `BUSINESS_NAME_SLOT` already uses — and the worker's existing
 *     compile step fills them from the bag below.
 *
 * Both go through `renderEmailTemplateHtml`, so both are shell-wrapped, inlined
 * and SANITIZED LAST on the one code path. The copy below never changes to make
 * the sanitizer happy; if something here does not survive it, the copy changes.
 */

import type { EmailContentJson } from "@/lib/email/email-content-json";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import type { EmailShellTenant } from "@/lib/email/email-shell";
import { CAMPAIGN_NAME_FALLBACK } from "@/lib/email/campaign-send";
import { resolveBusinessAddress } from "@/lib/email/email-shell";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

/** Where the store's own name goes in a system template's body. */
const BUSINESS_NAME_TAG = "{{businessName}}";

/** Where this recipient's first name goes. */
const USER_NAME_TAG = "{{userName}}";

/** Where the storefront link goes. Filled per recipient by the worker. */
const STORE_URL_TAG = "{{storeUrl}}";

/**
 * The platform's default reminder.
 *
 * Deliberately short and deliberately not a sales pitch: it is an unsolicited
 * message to somebody who bought once, so it says why it arrived, offers one
 * link, and stops. A store that wants more maps a template of its own — which
 * is the entire reason this event appears in the event mapper.
 *
 * Authored as TipTap JSON rather than HTML so it goes through exactly the
 * pipeline an admin-authored template goes through, against the same extension
 * set. A string of HTML here would be the one email body on the platform that
 * never met `parseEmailContentJson`.
 */
export const REORDER_REMINDER_DOC: EmailContentJson = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: `Running low, ${USER_NAME_TAG}?` }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `It has been a while since your last order from ${BUSINESS_NAME_TAG}, so this is a nudge in case it is time for another.`,
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Nothing needed if you are still stocked up — you will not hear from us about this again for a while.",
        },
      ],
    },
    {
      type: "emailButton",
      attrs: { href: STORE_URL_TAG, label: "Browse the store" },
    },
  ],
};

/**
 * The shell inputs for the SEEDED system template.
 *
 * Slots, not values: this template is mailed on behalf of whichever store the
 * worker resolves it for, so baking one business name or one registered office
 * into it would put the wrong store's details in every other store's footer.
 * `businessAddress` travels through `settings` because that is the field
 * `resolveBusinessAddress` reads first (US-010).
 *
 * No logo — it is not a Handlebars variable any send site populates, and a
 * broken `<img>` is worse than an absent one.
 */
const SYSTEM_SLOT_TENANT: EmailShellTenant = {
  businessName: BUSINESS_NAME_TAG,
  subdomain: "",
  customDomain: null,
  settings: { businessAddress: "{{businessAddress}}" },
};

/** The tenant-branded body the sweep enqueues, with `{{unsubscribeUrl}}` left as a slot. */
export function renderReorderReminderHtml(
  tenant: EmailShellTenant,
): Promise<string> {
  return renderEmailTemplateHtml({
    contentJson: REORDER_REMINDER_DOC,
    tenant,
    category: "marketing",
  });
}

/** The seeded system default — slots where a store's own details go. */
export function renderReorderReminderSystemHtml(): Promise<string> {
  return renderEmailTemplateHtml({
    contentJson: REORDER_REMINDER_DOC,
    tenant: SYSTEM_SLOT_TENANT,
    category: "marketing",
  });
}

export interface ReorderVariableInput {
  readonly tenant: EmailShellTenant;
  readonly email: string;
  readonly name?: string | null;
  readonly unsubscribeUrl: string;
}

/**
 * What `{{tags}}` are worth for ONE recipient.
 *
 * VALUES ONLY — never template source, the rule `campaignRecipientVariables`
 * states: every one of these is filled through `{{ }}`, which escapes, so a
 * customer whose name is `<script>` is a harmless string in the rendered email.
 *
 * `businessAddress` is here and not in the campaign bag because a system
 * template's footer has a slot for it (see {@link SYSTEM_SLOT_TENANT}). Empty
 * string rather than absent when the store has set none: Handlebars fills a
 * missing key with an empty string anyway, and stating it keeps the two renders
 * producing the same footer.
 */
export function reorderReminderVariables(
  input: ReorderVariableInput,
): Record<string, string> {
  const baseUrl = getTenantBaseUrl(input.tenant);
  const userName = input.name?.trim() || CAMPAIGN_NAME_FALLBACK;

  return {
    businessName: input.tenant.businessName,
    tenantName: input.tenant.businessName,
    subdomain: input.tenant.subdomain,
    businessAddress: resolveBusinessAddress(input.tenant) ?? "",
    storeUrl: baseUrl,
    loginUrl: `${baseUrl}/auth/signin`,
    userName,
    name: userName,
    email: input.email,
    unsubscribeUrl: input.unsubscribeUrl,
  };
}
