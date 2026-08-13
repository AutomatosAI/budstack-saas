/**
 * US-011 — validation and normalisation of authored email content BEFORE it is
 * rendered.
 *
 * Everything here operates on the TipTap document, not on HTML. Deciding about
 * images at the JSON layer means the rules are applied to structured data with
 * an exact shape instead of being regexed out of a serialised string, and the
 * author gets told which rule they broke rather than watching an image quietly
 * disappear.
 *
 * Two rules, both EMAIL-CRITICAL:
 *
 *  1. Every image `src` that survives is an ABSOLUTE http(s) URL (or a small
 *     inline `data:` image). An inbox has no origin, so US-005's deliberately
 *     origin-relative `/api/public/images/...` path resolves to nothing once the
 *     message leaves — see `lib/email/email-asset-url.ts`.
 *  2. A pasted `data:` image over `EMAIL_MAX_INLINE_IMAGE_BYTES` is refused.
 *     Base64 inflates by a third, the stored document is capped at
 *     `EMAIL_HTML_MAX_LENGTH`, and several providers reject or clip large inline
 *     payloads outright — so a screenshot dropped into the editor has to be
 *     uploaded and hosted, not embedded.
 *
 * Pure: no database, no network, no rendering. Throws `ApiError` (400) with a
 * message written for the author, so route handlers need no special-casing.
 */

import { z } from "zod";

import { ApiError } from "@/lib/api-error";
import { absoluteEmailImageUrl } from "@/lib/email/email-asset-url";

/** Ceiling for an inline (`data:`) image, measured on the DECODED bytes. */
export const EMAIL_MAX_INLINE_IMAGE_BYTES = 10 * 1024;

/**
 * The inline image types we accept, matching US-005's served-image allow-list
 * (`lib/storage/public-image-url.ts`). SVG is absent for the same reason it is
 * absent there: it is XML and can carry script.
 */
const INLINE_IMAGE_TYPE = /^data:image\/(?:png|jpeg|jpg|gif|webp)[;,]/i;

const IMAGE_SOURCE_MESSAGE =
  "Every image in an email needs a full web address. Upload the image, or paste a link starting with https://.";
const INLINE_IMAGE_TYPE_MESSAGE =
  "A pasted image is in a format email clients cannot show. Upload it as a PNG, JPEG, GIF or WebP instead.";
const INLINE_IMAGE_SIZE_MESSAGE = `A pasted image is too large to embed (limit ${
  EMAIL_MAX_INLINE_IMAGE_BYTES / 1024
} KB). Upload it instead so the email links to the hosted image.`;
const CONTENT_SHAPE_MESSAGE =
  "This email's content could not be read. Reload the page and try again.";

/**
 * Node attributes are JSON, not `unknown`.
 *
 * Stating that in the type is what lets the validated document be handed
 * straight to Prisma's Json column without a cast, and it makes the schema
 * reject at the boundary the values that would not survive a round trip
 * (`undefined`, a function, a Date) instead of letting `JSON.stringify` drop
 * them silently somewhere downstream.
 */
export type EmailJsonValue =
  | string
  | number
  | boolean
  | null
  | EmailJsonValue[]
  | { [key: string]: EmailJsonValue };

const emailJsonValueSchema: z.ZodType<EmailJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(emailJsonValueSchema),
    z.record(emailJsonValueSchema),
  ]),
);

/** One node of a TipTap/ProseMirror document. */
export interface EmailDocNode {
  type?: string;
  attrs?: Record<string, EmailJsonValue>;
  content?: EmailDocNode[];
  marks?: { type: string; attrs?: Record<string, EmailJsonValue> }[];
  text?: string;
}

const NAME_MAX = 100;

const emailDocNodeSchema: z.ZodType<EmailDocNode> = z.lazy(() =>
  z.object({
    type: z.string().max(NAME_MAX).optional(),
    attrs: z.record(emailJsonValueSchema).optional(),
    content: z.array(emailDocNodeSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string().max(NAME_MAX),
          attrs: z.record(emailJsonValueSchema).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }),
);

/**
 * How deep a document may nest before it is refused.
 *
 * Real content bottoms out fast — `doc > bulletList > listItem > paragraph >
 * text` is five, and a blockquote around it is six. The cap is far above
 * anything an author produces and far below what hurts.
 */
export const EMAIL_DOC_MAX_DEPTH = 64;

/**
 * Depth check that does NOT recurse, run before the recursive schema below.
 *
 * `z.lazy` validates by recursion, so a deeply nested payload overflows the
 * stack INSIDE `safeParse` — which throws a `RangeError` rather than returning
 * `{success:false}`, and every caller (`lib/validation/body.ts`) is written on
 * the promise that safeParse cannot throw. The result would be a 500 on what is
 * plainly malformed input. ~850 levels does it, in a 21KB body: well under the
 * 512KB cap the routes parse with, so the size limit is no defence.
 *
 * Rejecting first, with an explicit stack, keeps that input a clean 400.
 */
function isWithinDepth(value: unknown, maxDepth: number): boolean {
  const pending: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];

  while (pending.length > 0) {
    const { node, depth } = pending.pop()!;
    if (node === null || typeof node !== "object") continue;
    if (depth > maxDepth) return false;
    for (const child of Object.values(node)) {
      pending.push({ node: child, depth: depth + 1 });
    }
  }
  return true;
}

/** A whole authored document — what `email_templates.contentJson` stores. */
export interface EmailContentJson {
  type: "doc";
  content?: EmailDocNode[];
}

/**
 * The request-boundary shape of `contentJson`. Deliberately structural rather
 * than an enumeration of node types: the authoritative check is `Node.fromJSON`
 * against the shared schema at render time, which knows exactly which nodes and
 * attributes exist. This one only proves the payload is a ProseMirror document
 * and not an arbitrary object graph.
 *
 * The preprocess step is the depth guard: an over-deep payload is replaced with
 * `undefined`, which the schema then rejects normally, so the recursive parse
 * never runs on it.
 *
 * The type is annotated rather than inferred because `z.preprocess` widens its
 * INPUT to unknown; without it, callers destructuring a parsed body would see
 * `unknown` instead of a document.
 */
export const emailContentJsonSchema: z.ZodType<
  EmailContentJson,
  z.ZodTypeDef,
  unknown
> = z.preprocess(
  (value) => (isWithinDepth(value, EMAIL_DOC_MAX_DEPTH) ? value : undefined),
  z.object({
    type: z.literal("doc"),
    content: z.array(emailDocNodeSchema).optional(),
  }),
);

/** Narrow an untrusted value to a document, or reject it with a 400. */
export function parseEmailContentJson(value: unknown): EmailContentJson {
  const result = emailContentJsonSchema.safeParse(value);
  if (!result.success) throw new ApiError(CONTENT_SHAPE_MESSAGE, 400);
  return result.data;
}

/** Decoded byte length of a base64 payload, without allocating a Buffer. */
function base64ByteLength(payload: string): number {
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/** Accept a small inline image unchanged, or reject it with the reason why. */
function checkedInlineImage(src: string): string {
  if (!INLINE_IMAGE_TYPE.test(src)) {
    throw new ApiError(INLINE_IMAGE_TYPE_MESSAGE, 400);
  }

  const separator = src.indexOf(",");
  if (separator < 0) throw new ApiError(INLINE_IMAGE_TYPE_MESSAGE, 400);

  const meta = src.slice(0, separator);
  const payload = src.slice(separator + 1);
  const bytes = /;base64$/i.test(meta)
    ? base64ByteLength(payload)
    : Buffer.byteLength(payload, "utf8");

  if (bytes > EMAIL_MAX_INLINE_IMAGE_BYTES) {
    throw new ApiError(INLINE_IMAGE_SIZE_MESSAGE, 400);
  }
  return src;
}

/**
 * The `src` this image will carry in the sent message.
 *
 * `baseUrl` is null for a SYSTEM template, which has no tenant and therefore no
 * origin to resolve against; there, only an already-absolute URL can be
 * accepted. Nothing is dropped silently — an unusable source is an error the
 * author can act on.
 */
function resolveImageSrc(raw: unknown, baseUrl: string | null): string {
  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) throw new ApiError(IMAGE_SOURCE_MESSAGE, 400);

  if (/^data:/i.test(src)) return checkedInlineImage(src);

  const absolute = baseUrl ? absoluteEmailImageUrl(src, baseUrl) : null;
  if (absolute) return absolute;
  if (/^https?:\/\//i.test(src)) return src;

  throw new ApiError(IMAGE_SOURCE_MESSAGE, 400);
}

/** Rebuild a node with its children normalised. Never mutates the input. */
function normaliseNode(node: EmailDocNode, baseUrl: string | null): EmailDocNode {
  const content = node.content?.map((child) => normaliseNode(child, baseUrl));
  const base = content ? { ...node, content } : node;

  if (base.type !== "image") return base;
  return { ...base, attrs: { ...base.attrs, src: resolveImageSrc(base.attrs?.src, baseUrl) } };
}

/**
 * Return a copy of the document with every image source resolved to something
 * an inbox can fetch, or throw the first rule an image breaks.
 */
export function normaliseEmailContentJson(
  doc: EmailContentJson,
  baseUrl: string | null,
): EmailContentJson {
  if (!doc.content) return doc;
  return { ...doc, content: doc.content.map((node) => normaliseNode(node, baseUrl)) };
}
