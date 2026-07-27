import { describe, expect, it } from "vitest";
import {
  MissingLegalTokenError,
  findUnresolvedTokens,
  renderTemplate,
} from "@/lib/legal/render-policy";
import {
  PRIVACY_REQUIRED_TOKENS,
  PRIVACY_TEMPLATE,
  PRIVACY_TEMPLATE_VERSION,
} from "@/lib/legal/privacy-template";

/**
 * WS2 US-007 — the merge engine behind per-tenant privacy notices.
 *
 * The failure that matters is a notice that renders but is incomplete: it looks
 * authoritative while failing the Art. 13 duty it exists to discharge. So the
 * engine throws rather than emitting an empty string or a literal {{token}}.
 */

const COMPLETE = {
  controllerLegalName: "HealingBuds Ltd",
  registeredAddress: "12 Example Street, London EC1A 1AA",
  privacyContactEmail: "privacy@healingbuds.com",
  icoRegistrationNumber: "ZA123456",
  dpoName: "Jordan Reeves",
  dpoContact: "dpo@healingbuds.com",
  ukRepresentative: "LHI Consulting Ltd",
};

describe("renderTemplate", () => {
  it("substitutes required tokens", () => {
    const out = renderTemplate("Controller: {{controllerLegalName}}.", COMPLETE, [
      "controllerLegalName",
    ]);
    expect(out).toBe("Controller: HealingBuds Ltd.");
  });

  it("throws when a required token is missing", () => {
    expect(() =>
      renderTemplate("{{controllerLegalName}}", {}, ["controllerLegalName"]),
    ).toThrow(MissingLegalTokenError);
  });

  it("throws when a required token is blank or whitespace", () => {
    expect(() =>
      renderTemplate("{{controllerLegalName}}", { controllerLegalName: "   " }, [
        "controllerLegalName",
      ]),
    ).toThrow(MissingLegalTokenError);
  });

  it("names every missing token in the error", () => {
    try {
      renderTemplate("x", {}, ["controllerLegalName", "privacyContactEmail"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingLegalTokenError);
      expect((error as MissingLegalTokenError).tokens).toEqual([
        "controllerLegalName",
        "privacyContactEmail",
      ]);
    }
  });

  it("keeps a conditional block when its value is present", () => {
    const out = renderTemplate(
      "{{#dpoName}}DPO is {{dpoName}}.{{/dpoName}}",
      { dpoName: "Jordan Reeves" },
      [],
    );
    expect(out).toBe("DPO is Jordan Reeves.");
  });

  it("drops a conditional block when its value is absent", () => {
    const out = renderTemplate(
      "before{{#dpoName}} DPO is {{dpoName}}.{{/dpoName}}after",
      {},
      [],
    );
    expect(out).toBe("beforeafter");
  });

  it("drops a nested conditional independently of its parent", () => {
    const out = renderTemplate(
      "{{#dpoName}}DPO {{dpoName}}{{#dpoContact}} at {{dpoContact}}{{/dpoContact}}.{{/dpoName}}",
      { dpoName: "Jordan Reeves" },
      [],
    );
    expect(out).toBe("DPO Jordan Reeves.");
  });

  it("never leaves an unresolved token behind", () => {
    expect(() => renderTemplate("Hello {{unknownToken}}", {}, [])).toThrow(
      MissingLegalTokenError,
    );
  });
});

describe("findUnresolvedTokens", () => {
  it("reports each unresolved token once", () => {
    expect(findUnresolvedTokens("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });

  it("returns nothing for fully rendered text", () => {
    expect(findUnresolvedTokens("all done")).toEqual([]);
  });
});

describe("the shipped privacy template", () => {
  it("renders with a complete legal profile", () => {
    const out = renderTemplate(PRIVACY_TEMPLATE, COMPLETE, PRIVACY_REQUIRED_TOKENS);
    expect(out).toContain("HealingBuds Ltd");
    expect(out).toContain("privacy@healingbuds.com");
    expect(findUnresolvedTokens(out)).toEqual([]);
  });

  it("renders with only the required fields supplied", () => {
    const minimal = {
      controllerLegalName: COMPLETE.controllerLegalName,
      registeredAddress: COMPLETE.registeredAddress,
      privacyContactEmail: COMPLETE.privacyContactEmail,
    };
    const out = renderTemplate(PRIVACY_TEMPLATE, minimal, PRIVACY_REQUIRED_TOKENS);

    expect(findUnresolvedTokens(out)).toEqual([]);
    // Optional blocks are dropped, not rendered half-empty.
    expect(out).not.toContain("Data Protection Officer");
    expect(out).not.toContain("registration number");
    expect(out).not.toContain("Article 27");
  });

  it("refuses to render without a controller identity", () => {
    expect(() =>
      renderTemplate(
        PRIVACY_TEMPLATE,
        { privacyContactEmail: "x@y.com", registeredAddress: "somewhere" },
        PRIVACY_REQUIRED_TOKENS,
      ),
    ).toThrow(MissingLegalTokenError);
  });

  it("states the Dr Green controller-to-controller position", () => {
    // If this fails, the template and the sub-processor register have diverged.
    // They must change together — see WS4 US-015.
    const out = renderTemplate(PRIVACY_TEMPLATE, COMPLETE, PRIVACY_REQUIRED_TOKENS);
    expect(out).toContain("separate, independent data controller");
  });

  it("does not claim BudStacks is the controller", () => {
    const out = renderTemplate(PRIVACY_TEMPLATE, COMPLETE, PRIVACY_REQUIRED_TOKENS);
    expect(out).not.toMatch(/BudStacks[^.]*\bis the data controller\b/i);
  });

  it("carries a semver version", () => {
    expect(PRIVACY_TEMPLATE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
