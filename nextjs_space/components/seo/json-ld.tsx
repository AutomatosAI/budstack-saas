import { headers } from "next/headers";

import {
  JSON_LD_SCRIPT_TYPE,
  serializeJsonLd,
  type JsonLdNode,
} from "@/lib/seo/json-ld";

/**
 * SEO Supercharge US-014 — the one element that puts JSON-LD in the document.
 *
 * Server component. Every Workstream C story that emits structured data
 * (Product, Article, BreadcrumbList, FAQPage) renders THIS, so the escaping in
 * `serializeJsonLd` cannot be bypassed by a page that reaches for
 * `JSON.stringify` on its own.
 *
 * `dangerouslySetInnerHTML` is required and is safe HERE, specifically because
 * of that serializer: React would otherwise HTML-escape the JSON (turning `"`
 * into `&quot;` inside a script element, where entities are NOT decoded), which
 * produces a block no consumer can parse. What makes the raw write safe is that
 * the string cannot contain `<` — see `lib/seo/json-ld.ts`.
 *
 * NONCE (`middleware.ts:88-92`, `lib/security/csp.ts`): `application/ld+json`
 * is a data block, not executable script, so a CSP3 browser never runs it and
 * `strict-dynamic` never gates it. The per-request nonce is attached anyway —
 * it costs one header read, it is what a stricter policy or a CSP2 browser
 * would look for, and it keeps every `<script>` this app emits consistent.
 * `headers()` is already read on this route by tenant resolution, so it adds no
 * dynamic-rendering constraint that was not there.
 */
export function JsonLd({ nodes }: { nodes: readonly JsonLdNode[] }) {
  const json = serializeJsonLd(nodes);
  if (!json) return null;

  return (
    <script
      type={JSON_LD_SCRIPT_TYPE}
      nonce={headers().get("x-nonce") ?? undefined}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
