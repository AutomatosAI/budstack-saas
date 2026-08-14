/**
 * SEO Supercharge US-025 — turning one stored row into the closed
 * {@link AiAssistSource} the prompt is built from.
 *
 * THE SOURCE IS RESOLVED SERVER-SIDE, NEVER SENT BY THE BROWSER. The request
 * carries an entity type and an id and nothing else; the route reads the row
 * itself, scoped to the caller's tenant, and hands it here. That is what makes
 * US-024's "the prompt contains only this tenant's own content" assertion true at
 * the API boundary as well as inside the service: there is no field on the wire
 * a caller could put arbitrary text into, and no way to have a draft written
 * against a row belonging to somebody else.
 *
 * It also means the draft is grounded in what the STOREFRONT renders rather than
 * in unsaved form state — the copy being optimised is the copy visitors read.
 *
 * Pure module — no prisma, no next. The row shapes below are structural, so the
 * route's explicitly-annotated selects satisfy them without this file importing
 * a Prisma type (`lib/db.ts`'s client is any-widened by its build-time mock
 * Proxy, so an inferred row would collapse to `any` anyway).
 */

import type { AiAssistSource } from "@/lib/seo/ai-assist-contract";
import { storeSeoPage, type StoreSeoPageKey } from "@/lib/seo/store-pages";

/** Only the columns the prompt is allowed to see. */
export interface AiAssistProductRow {
  readonly name: string;
  readonly description: string | null;
}

export interface AiAssistPostRow {
  readonly title: string;
  readonly excerpt: string | null;
  readonly content: string;
}

export interface AiAssistConditionRow {
  readonly name: string;
  readonly description: string | null;
}

/**
 * Post bodies are Tiptap HTML. A model handed raw markup spends its attention on
 * tags and happily copies one into the answer, so the tags come out first.
 *
 * Deliberately a stripper, not a sanitiser: nothing here is rendered — the text
 * goes into a prompt — so the job is "leave readable prose", not "make safe
 * HTML". `<` inside prose survives because only a tag-shaped run is removed, and
 * block tags become a space so two paragraphs do not weld into one word.
 */
export function htmlToPromptText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** `storeName` is the tenant's own business name — never another tenant's. */
export interface AiAssistTenantContext {
  readonly storeName?: string | null;
}

function withStore(
  source: Omit<AiAssistSource, "storeName">,
  tenant: AiAssistTenantContext,
): AiAssistSource {
  const storeName = tenant.storeName?.trim();
  return storeName ? { ...source, storeName } : source;
}

export function productAiAssistSource(
  row: AiAssistProductRow,
  tenant: AiAssistTenantContext = {},
): AiAssistSource {
  return withStore(
    {
      entityKind: "product",
      name: row.name,
      ...(row.description ? { body: row.description } : {}),
    },
    tenant,
  );
}

/**
 * The excerpt leads because it is the author's own summary of the article — the
 * thing a meta description is trying to be. The body is the fallback, and only
 * ever an excerpt of itself (the contract clips it at 1200 characters).
 */
export function postAiAssistSource(
  row: AiAssistPostRow,
  tenant: AiAssistTenantContext = {},
): AiAssistSource {
  const body = row.excerpt?.trim() || htmlToPromptText(row.content);
  return withStore(
    {
      entityKind: "post",
      name: row.title,
      ...(body ? { body } : {}),
    },
    tenant,
  );
}

export function conditionAiAssistSource(
  row: AiAssistConditionRow,
  tenant: AiAssistTenantContext = {},
): AiAssistSource {
  return withStore(
    {
      entityKind: "condition",
      name: row.name,
      ...(row.description ? { body: row.description } : {}),
    },
    tenant,
  );
}

/**
 * A store page has no row of its own — `tenants.pageSeo` holds the metadata
 * being authored, which is the output, not the input. So the source is the
 * page's name and the store's, and the model is asked to write about a known
 * kind of page rather than to summarise copy it has not been given.
 */
export function storePageAiAssistSource(
  key: StoreSeoPageKey,
  tenant: AiAssistTenantContext = {},
): AiAssistSource {
  return withStore(
    { entityKind: "page", name: storeSeoPage(key).name },
    tenant,
  );
}
