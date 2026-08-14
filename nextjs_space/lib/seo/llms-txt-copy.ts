/**
 * LLM Visibility US-003 — the two things about llms.txt a BROWSER bundle may
 * hold: where the file is published, and what the SEO Manager tells an owner it
 * is worth.
 *
 * WHY IT IS NOT IN `llms-txt.ts`. That module builds the document, and to do it
 * reaches `lib/seo/json-ld.ts` → `lib/storage/public-image-url` → `lib/api-error`
 * → pino. The card that advertises the file is rendered inside the SEO Manager,
 * which is a client component, so importing the builder for one string would
 * pull a server logger into the browser bundle. Same reason `product-paths.ts`
 * and `wire-paths.ts` exist. Dependency-free on purpose — keep it that way.
 *
 * THE COPY IS AN ACCEPTANCE CRITERION, NOT DECORATION. llms.txt is the one
 * feature in this run with no evidence behind it, and the story requires the UI
 * to say so: proposed standard, roughly 10% adoption, no measured citation lift,
 * no cost. Constants rather than JSX literals so a test can assert all four
 * claims are still on the screen, the way `AI_CRAWLER_POLICY_NOTE` does for
 * US-001's published-request caveat.
 *
 * SOURCE for the adoption and lift figures, checked 2026-08-14: SE Ranking's
 * study of 300,000 domains, which found llms.txt files on ~10% of them and no
 * measurable difference in AI citations between sites that published one and
 * sites that did not. No engine operator has confirmed it reads the file.
 */

/** The published file's path, on the store's own host. */
export const LLMS_TXT_PATH = "/llms.txt";

export interface LlmsTxtHonestyCopy {
  /** What the file contains — no claim about what it achieves. */
  readonly whatItIs: string;
  /** What is known about whether it works. States that nothing is. */
  readonly evidence: string;
  /** The actual case for shipping it: it is free. */
  readonly whyItShips: string;
  /** What the owner has to do to keep it current: nothing. */
  readonly upkeep: string;
}

export const LLMS_TXT_HONESTY_COPY: LlmsTxtHonestyCopy = {
  whatItIs:
    "Your store publishes a plain-text index of itself — business name and address, your condition guides, your products and your Wire posts, as markdown a language model can read in a single request instead of crawling every page.",
  evidence:
    "llms.txt is a proposed standard, not one any AI company has committed to reading. Around 10% of sites publish one, and the largest study of it so far — 300,000 domains, by SE Ranking — found no measurable change in AI citations for the sites that did. Nobody can honestly tell you this will get your store cited more often, and this page will not.",
  whyItShips:
    "It is here because it costs nothing. The file is generated from the catalogue you already maintain, so it takes no work to write and none to keep current. If the standard is adopted, your store already complies. That is the whole case for it.",
  upkeep:
    "It regenerates on request, so it is current the moment you publish a product, a guide or a post — there is nothing to update by hand.",
};
