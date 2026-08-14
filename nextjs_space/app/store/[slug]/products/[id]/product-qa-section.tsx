import { ChevronDown } from "lucide-react";

import type { ProductQaPair } from "@/lib/seo/product-qa";

/**
 * LLM Visibility US-002 — the product's Q&A, rendered for a person.
 *
 * A SERVER COMPONENT, AND THAT IS THE WHOLE POINT. `ProductDetailClient` fetches
 * the strain in the browser and its first render — the one that is server-side
 * rendered into the initial HTML — is the loading spinner. Anything placed
 * inside it therefore does not exist for a reader that does not execute
 * JavaScript, which is most of the answer engines this feature is aimed at, and
 * the `FAQPage` node in the same page's head would then be describing content no
 * crawler could verify was on the page. Rendering the pairs here puts the
 * questions and the answers in the initial HTML, from the same array the JSON-LD
 * is built from.
 *
 * `<details>`/`<summary>` rather than a button and a state hook: it collapses,
 * it is keyboard-operable and screen-reader-announced with no client JavaScript
 * at all, and the answer stays in the DOM while collapsed — which is what makes
 * it readable to a crawler and quotable by an extractor.
 *
 * TENANT COLOURS, NOT `bs-*`. The admin design system's component classes carry
 * the admin's dark palette and are applied on `[data-surface="admin"]` surfaces
 * (app/globals.css); no storefront page uses one. This block is themed the way
 * every other block on the product page is — through the tenant's own CSS
 * variables — so a store's Q&A looks like the store.
 */
export function ProductQaSection({
  pairs,
}: {
  /** Already plan-gated and parsed by `productQaEntries`. Empty renders nothing. */
  pairs: readonly ProductQaPair[];
}) {
  if (pairs.length === 0) return null;

  return (
    <section
      aria-labelledby="product-qa-heading"
      style={{
        backgroundColor: "hsl(var(--tenant-color-background))",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2
          id="product-qa-heading"
          className="text-3xl font-bold mb-8"
          style={{
            color: "hsl(var(--tenant-color-heading))",
            fontFamily: "var(--tenant-font-heading, inherit)",
          }}
        >
          Questions &amp; Answers
        </h2>

        <div className="space-y-4">
          {pairs.map((pair, index) => (
            <details
              // The pairs are an ordered list with no ids of their own; the
              // index is the stable key because the server re-renders the whole
              // list or none of it.
              key={index}
              open={index === 0}
              className="group rounded-xl border overflow-hidden"
              style={{ borderColor: "hsl(var(--tenant-color-border))" }}
            >
              <summary
                // `list-none` plus the webkit marker rule removes the browser's
                // default triangle so the chevron below is the only affordance.
                className="flex cursor-pointer items-center justify-between gap-4 p-6 list-none [&::-webkit-details-marker]:hidden"
                style={{ backgroundColor: "hsl(var(--tenant-color-surface))" }}
              >
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "hsl(var(--tenant-color-heading))" }}
                >
                  {pair.question}
                </h3>
                <ChevronDown
                  className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-open:rotate-180"
                  style={{ color: "hsl(var(--tenant-color-text))" }}
                  aria-hidden="true"
                />
              </summary>
              <div className="px-6 pb-6 pt-4">
                <p
                  className="opacity-80 leading-relaxed whitespace-pre-line"
                  style={{ color: "hsl(var(--tenant-color-text))" }}
                >
                  {pair.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
