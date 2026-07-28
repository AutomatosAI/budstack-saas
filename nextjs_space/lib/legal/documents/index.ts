/**
 * The legal documents an operator publishes on their own domain.
 *
 * All four had the same defect: the storefront route re-exported the BudStacks
 * platform page, so an operator's domain served the platform's documents under
 * the operator's brand. For terms that is the sharper problem — it names the
 * wrong party to the customer's contract.
 *
 * One registry rather than four implementations, so a fifth document is a data
 * change and every document inherits the same publish, fallback and versioning
 * behaviour.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

import {
  PRIVACY_REQUIRED_TOKENS,
  PRIVACY_TEMPLATE,
  PRIVACY_TEMPLATE_VERSION,
} from "../privacy-template";
import {
  TERMS_REQUIRED_TOKENS,
  TERMS_TEMPLATE,
  TERMS_TEMPLATE_VERSION,
} from "./terms-template";
import {
  COOKIES_REQUIRED_TOKENS,
  COOKIES_TEMPLATE,
  COOKIES_TEMPLATE_VERSION,
} from "./cookies-template";
import {
  REGULATORY_REQUIRED_TOKENS,
  REGULATORY_TEMPLATE,
  REGULATORY_TEMPLATE_VERSION,
} from "./regulatory-template";

export type LegalDocumentSlug = "privacy" | "terms" | "cookies" | "regulatory";

export interface LegalDocument {
  slug: LegalDocumentSlug;
  /** Page heading and browser title. */
  title: string;
  /** One line shown in the admin, explaining what the operator is publishing. */
  summary: string;
  version: string;
  template: string;
  requiredTokens: readonly string[];
}

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentSlug, LegalDocument>> =
  Object.freeze({
    privacy: {
      slug: "privacy",
      title: "Privacy Policy",
      summary:
        "How you handle customers' personal information, and the rights they have over it.",
      version: PRIVACY_TEMPLATE_VERSION,
      template: PRIVACY_TEMPLATE,
      requiredTokens: PRIVACY_REQUIRED_TOKENS,
    },
    terms: {
      slug: "terms",
      title: "Terms of Sale",
      summary:
        "Your contract with your customer — ordering, delivery, returns and liability.",
      version: TERMS_TEMPLATE_VERSION,
      template: TERMS_TEMPLATE,
      requiredTokens: TERMS_REQUIRED_TOKENS,
    },
    cookies: {
      slug: "cookies",
      title: "Cookie Notice",
      summary: "What is stored on visitors' devices, and what they consented to.",
      version: COOKIES_TEMPLATE_VERSION,
      template: COOKIES_TEMPLATE,
      requiredTokens: COOKIES_REQUIRED_TOKENS,
    },
    regulatory: {
      slug: "regulatory",
      title: "Regulatory Information",
      summary:
        "Your licence and regulator, and the boundary between your service and the prescriber.",
      version: REGULATORY_TEMPLATE_VERSION,
      template: REGULATORY_TEMPLATE,
      requiredTokens: REGULATORY_REQUIRED_TOKENS,
    },
  });

export const LEGAL_DOCUMENT_SLUGS = Object.keys(
  LEGAL_DOCUMENTS,
) as LegalDocumentSlug[];

export function getLegalDocument(slug: LegalDocumentSlug): LegalDocument {
  return LEGAL_DOCUMENTS[slug];
}
