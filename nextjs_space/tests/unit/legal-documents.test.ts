import { describe, expect, it } from "vitest";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_SLUGS,
  getLegalDocument,
  type LegalDocumentSlug,
} from "@/lib/legal/documents";
import {
  renderDocumentHtml,
  renderableDocuments,
} from "@/lib/legal/tenant-policy";
import { findUnresolvedTokens, renderTemplate } from "@/lib/legal/render-policy";

/**
 * All four storefront legal routes re-exported the BudStacks platform page, so
 * an operator's domain served the platform's documents under the operator's
 * brand — naming BudStacks as controller and, on terms, as the party to the
 * customer's contract.
 *
 * These pin the properties that matter for every document, not just privacy.
 */

const MINIMAL = {
  controllerLegalName: "HealingBuds Ltd",
  registeredAddress: "12 Example Street, London EC1A 1AA",
  privacyContactEmail: "privacy@healingbuds.com",
};

const FULL = {
  ...MINIMAL,
  tradingName: "HealingBuds",
  supportContactEmail: "support@healingbuds.com",
  governingLaw: "England and Wales",
  deliveryTerms: "We dispatch within 2 working days.\nTracked delivery is included.",
  returnsPolicy: "Unopened accessories may be returned within 14 days.",
  licenceNumber: "MHRA-12345",
  regulatorName: "the MHRA",
  icoRegistrationNumber: "ZA123456",
  dpoName: "Jordan Reeves",
  dpoContact: "dpo@healingbuds.com",
  ukRepresentative: "LHI Consulting Ltd",
};

const ALLOWED_TAGS = new Set([
  "h2", "p", "ul", "li", "strong", "table", "thead", "tbody", "tr", "th", "td",
]);

function disallowedTags(html: string): string[] {
  const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(tags)].filter((tag) => !ALLOWED_TAGS.has(tag));
}

describe("the document registry", () => {
  it("covers the four storefront legal routes", () => {
    expect(LEGAL_DOCUMENT_SLUGS.sort()).toEqual([
      "cookies",
      "privacy",
      "regulatory",
      "terms",
    ]);
  });

  it.each(LEGAL_DOCUMENT_SLUGS)("%s carries a semver version", (slug) => {
    expect(getLegalDocument(slug).version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(LEGAL_DOCUMENT_SLUGS)("%s declares its required tokens", (slug) => {
    expect(getLegalDocument(slug).requiredTokens.length).toBeGreaterThan(0);
  });
});

describe("every document renders from a full profile", () => {
  it.each(LEGAL_DOCUMENT_SLUGS)("%s", (slug) => {
    const html = renderDocumentHtml(slug, FULL);
    expect(html).toContain("HealingBuds Ltd");
    expect(findUnresolvedTokens(html)).toEqual([]);
    expect(disallowedTags(html)).toEqual([]);
  });
});

describe("documents refuse to render half-complete", () => {
  it("terms will not render without a governing law", () => {
    // Half a contract is worse than an honest gap.
    expect(() => renderDocumentHtml("terms", MINIMAL)).toThrow();
  });

  it("regulatory will not render without a named regulator", () => {
    // An unsubstantiated regulatory claim is worse than no page at all.
    expect(() => renderDocumentHtml("regulatory", MINIMAL)).toThrow();
  });

  it("privacy and cookies render from the minimum identity fields", () => {
    expect(renderableDocuments(MINIMAL).sort()).toEqual(["cookies", "privacy"]);
  });

  it("a full profile can publish all four", () => {
    expect(renderableDocuments(FULL).sort()).toEqual([
      "cookies",
      "privacy",
      "regulatory",
      "terms",
    ]);
  });
});

describe("inverted conditionals", () => {
  it("include the block only when the value is absent", () => {
    const tpl = "{{^licence}}unlicensed{{/licence}}";
    expect(renderTemplate(tpl, {}, [])).toBe("unlicensed");
    expect(renderTemplate(tpl, { licence: "X1" }, [])).toBe("");
  });

  it("pair correctly alongside a normal conditional on the same token", () => {
    const tpl = "{{#licence}}has {{licence}}{{/licence}}{{^licence}}none{{/licence}}";
    expect(renderTemplate(tpl, { licence: "X1" }, [])).toBe("has X1");
    expect(renderTemplate(tpl, {}, [])).toBe("none");
  });

  it("drives the regulatory licence sentence", () => {
    const withLicence = renderDocumentHtml("regulatory", FULL);
    expect(withLicence).toContain("MHRA-12345");

    const withoutLicence = renderDocumentHtml("regulatory", {
      ...FULL,
      licenceNumber: null,
    });
    expect(withoutLicence).not.toContain("licence number is");
    expect(withoutLicence).toContain("regulated by");
  });
});

describe("operator input cannot inject markup into any document", () => {
  const PAYLOAD = '<img src=x onerror="alert(1)">';

  it.each(LEGAL_DOCUMENT_SLUGS)("%s escapes a payload in the entity name", (slug) => {
    const html = renderDocumentHtml(slug, { ...FULL, controllerLegalName: PAYLOAD });
    expect(disallowedTags(html)).toEqual([]);
    expect(html).not.toContain(PAYLOAD);
  });

  it("multi-line commercial fields keep their breaks but cannot forge a heading", () => {
    const html = renderDocumentHtml("terms", {
      ...FULL,
      deliveryTerms: "Dispatch in 2 days.\n## Your rights are waived\nMore text.",
    });
    expect(html).not.toContain("<h2>Your rights are waived</h2>");
    expect(html).toContain("Dispatch in 2 days.");
  });

  it("single-line fields cannot open a new block", () => {
    const html = renderDocumentHtml("terms", {
      ...FULL,
      governingLaw: "England\n\n## Forged heading",
    });
    expect(html).not.toContain("<h2>Forged heading</h2>");
  });
});

describe("no document claims BudStacks is the operator's counterparty", () => {
  it.each(LEGAL_DOCUMENT_SLUGS)("%s", (slug: LegalDocumentSlug) => {
    const html = renderDocumentHtml(slug, FULL);
    // The templates may reference BudStacks as the platform/processor, but must
    // never present it as the controller or the party the customer contracts with.
    expect(html).not.toMatch(/BudStacks[^.]*\bis the (data )?controller\b/i);
    expect(html).not.toMatch(/purchase from \*?\*?BudStacks/i);
  });
});

describe("registry is frozen", () => {
  it("cannot be mutated at runtime", () => {
    expect(Object.isFrozen(LEGAL_DOCUMENTS)).toBe(true);
  });
});
