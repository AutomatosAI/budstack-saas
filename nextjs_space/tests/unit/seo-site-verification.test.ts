import { describe, expect, it } from "vitest";

/**
 * SEO Supercharge US-026 — the three structured fields, and the four conditions
 * that decide whether a GA4 tag loads.
 *
 * The properties this file holds:
 *
 *  1. NOTHING WITH MARKUP IN IT IS EVER STORED. A pasted meta tag is reduced to
 *     its token; anything that is not a token of that kind is refused, including
 *     the `<script>` an owner might paste into a field labelled "verification".
 *  2. THE CHARSET IS RE-APPLIED ON THE WAY OUT. A value that reached the column
 *     some other way is dropped from the render rather than emitted as a tag.
 *  3. PRO GATES BY DEGRADING. A Basic tenant emits no verification tags and
 *     loads no GA4; an unreadable plan is Basic, never Pro.
 *  4. THE GA4 TAG NEEDS THE STORE'S OWN ANALYTICS SWITCH AND THE VISITOR'S
 *     CONSENT. Neither is sufficient alone, and absent means no in both.
 */

import { analyticsConsentGranted } from "@/lib/cookie-utils";
import {
  BING_VERIFICATION_META_NAME,
  SITE_VERIFICATION_FIELDS,
  checkSiteVerificationField,
  isGa4MeasurementId,
  normalizeGa4MeasurementId,
  normalizeVerificationToken,
  readSiteVerification,
  storeGa4MeasurementId,
  storeVerificationMetadata,
} from "@/lib/seo/site-verification";

const TENANT = "tenant-a";
const GOOGLE_TOKEN = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEfg";
const BING_TOKEN = "0123456789ABCDEF0123456789ABCDEF";
const GA4_ID = "G-AB12CD34EF";

const spec = (key: string) => {
  const found = SITE_VERIFICATION_FIELDS.find((f) => f.key === key);
  if (!found) throw new Error(`no field spec for ${key}`);
  return found;
};

describe("normalizeVerificationToken", () => {
  it("keeps a bare token, trimmed", () => {
    expect(normalizeVerificationToken(`  ${GOOGLE_TOKEN}\n`)).toBe(GOOGLE_TOKEN);
  });

  it("takes the token out of the meta tag Search Console hands out", () => {
    expect(
      normalizeVerificationToken(
        `<meta name="google-site-verification" content="${GOOGLE_TOKEN}" />`,
      ),
    ).toBe(GOOGLE_TOKEN);
  });

  it("handles single quotes and loose spacing in a pasted tag", () => {
    expect(
      normalizeVerificationToken(
        `<meta name='msvalidate.01' content = '${BING_TOKEN}'>`,
      ),
    ).toBe(BING_TOKEN);
  });

  it("returns markup unchanged when there is no content attribute, so the charset check refuses it", () => {
    const pasted = "<script>alert(1)</script>";
    expect(normalizeVerificationToken(pasted)).toBe(pasted);
    expect(checkSiteVerificationField(spec("googleSiteVerification"), pasted).ok).toBe(
      false,
    );
  });

  it("is empty for anything that is not a string", () => {
    for (const value of [null, undefined, 42, {}, []]) {
      expect(normalizeVerificationToken(value)).toBe("");
    }
  });
});

describe("normalizeGa4MeasurementId", () => {
  it("upper-cases and trims what was pasted", () => {
    expect(normalizeGa4MeasurementId(" g-ab12cd34ef ")).toBe(GA4_ID);
  });
});

describe("checkSiteVerificationField", () => {
  it("accepts the real token formats", () => {
    expect(
      checkSiteVerificationField(spec("googleSiteVerification"), GOOGLE_TOKEN),
    ).toEqual({ ok: true, value: GOOGLE_TOKEN });
    expect(
      checkSiteVerificationField(spec("bingSiteVerification"), BING_TOKEN),
    ).toEqual({ ok: true, value: BING_TOKEN });
    expect(
      checkSiteVerificationField(spec("ga4MeasurementId"), "g-ab12cd34ef"),
    ).toEqual({ ok: true, value: GA4_ID });
  });

  it("treats empty as cleared rather than invalid — an owner must be able to remove a token", () => {
    for (const field of SITE_VERIFICATION_FIELDS) {
      expect(checkSiteVerificationField(field, "   ")).toEqual({
        ok: true,
        value: "",
      });
      expect(checkSiteVerificationField(field, null)).toEqual({
        ok: true,
        value: "",
      });
    }
  });

  it("refuses anything outside the field's own charset", () => {
    // A space, a quote and an angle bracket — the three that would matter if a
    // value ever reached an attribute or a script body.
    for (const bad of [
      `${GOOGLE_TOKEN} extra`,
      `${GOOGLE_TOKEN}"`,
      `<b>${GOOGLE_TOKEN}</b>`,
    ]) {
      expect(checkSiteVerificationField(spec("googleSiteVerification"), bad).ok).toBe(
        false,
      );
    }
    // Bing's is hex-ish: no underscores or hyphens.
    expect(
      checkSiteVerificationField(spec("bingSiteVerification"), GOOGLE_TOKEN).ok,
    ).toBe(false);
    // GA4 must be G- prefixed.
    expect(
      checkSiteVerificationField(spec("ga4MeasurementId"), "UA-12345-1").ok,
    ).toBe(false);
  });

  it("refuses a token longer than the field's cap", () => {
    const tooLong = "a".repeat(129);
    expect(
      checkSiteVerificationField(spec("googleSiteVerification"), tooLong).ok,
    ).toBe(false);
  });

  it("carries the field's own message, so the owner is told which one is wrong", () => {
    const rejected = checkSiteVerificationField(
      spec("ga4MeasurementId"),
      "UA-12345-1",
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toContain("G-XXXXXXXXXX");
  });
});

describe("readSiteVerification", () => {
  it("reads the three stored values back", () => {
    expect(
      readSiteVerification({
        googleSiteVerification: GOOGLE_TOKEN,
        bingSiteVerification: BING_TOKEN,
        ga4MeasurementId: GA4_ID,
      }),
    ).toEqual({
      googleSiteVerification: GOOGLE_TOKEN,
      bingSiteVerification: BING_TOKEN,
      ga4MeasurementId: GA4_ID,
    });
  });

  it("drops a stored value that no longer matches its charset", () => {
    // How it got there does not matter — a manual DB edit, an older writer, a
    // restored backup. It is not emitted as a tag.
    expect(
      readSiteVerification({
        googleSiteVerification: '"><script>alert(1)</script>',
        ga4MeasurementId: "G-",
      }),
    ).toEqual({
      googleSiteVerification: "",
      bingSiteVerification: "",
      ga4MeasurementId: "",
    });
  });

  it("is empty for a tenant with no settings at all", () => {
    expect(readSiteVerification(null)).toEqual({
      googleSiteVerification: "",
      bingSiteVerification: "",
      ga4MeasurementId: "",
    });
    expect(readSiteVerification({})).toEqual({
      googleSiteVerification: "",
      bingSiteVerification: "",
      ga4MeasurementId: "",
    });
  });
});

describe("storeVerificationMetadata", () => {
  const settings = {
    googleSiteVerification: GOOGLE_TOKEN,
    bingSiteVerification: BING_TOKEN,
  };

  it("emits both tokens for a Pro tenant", () => {
    expect(
      storeVerificationMetadata({ tenantId: TENANT, plan: "pro", settings }),
    ).toEqual({
      google: GOOGLE_TOKEN,
      other: { [BING_VERIFICATION_META_NAME]: BING_TOKEN },
    });
  });

  it("emits only what was configured", () => {
    expect(
      storeVerificationMetadata({
        tenantId: TENANT,
        plan: "pro",
        settings: { googleSiteVerification: GOOGLE_TOKEN },
      }),
    ).toEqual({ google: GOOGLE_TOKEN });
  });

  it("emits nothing for a Basic tenant, however much is stored", () => {
    expect(
      storeVerificationMetadata({ tenantId: TENANT, plan: "basic", settings }),
    ).toBeUndefined();
  });

  it("unlocks trial and custom like every other Pro surface", () => {
    for (const plan of ["trial", "custom"]) {
      expect(
        storeVerificationMetadata({ tenantId: TENANT, plan, settings }),
      ).toBeDefined();
    }
  });

  it("fails closed on an unreadable plan", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 7]) {
      expect(
        storeVerificationMetadata({ tenantId: TENANT, plan, settings }),
      ).toBeUndefined();
    }
  });

  it("is undefined when a Pro tenant has verified nothing", () => {
    expect(
      storeVerificationMetadata({ tenantId: TENANT, plan: "pro", settings: {} }),
    ).toBeUndefined();
  });
});

describe("storeGa4MeasurementId", () => {
  const configured = { ga4MeasurementId: GA4_ID, analyticsEnabled: true };

  it("returns the id when the plan, the id and the store's analytics switch all agree", () => {
    expect(
      storeGa4MeasurementId({ tenantId: TENANT, plan: "pro", settings: configured }),
    ).toBe(GA4_ID);
  });

  it("returns null while the store's Analytics Cookies switch is off or unset", () => {
    for (const analyticsEnabled of [false, null, undefined]) {
      expect(
        storeGa4MeasurementId({
          tenantId: TENANT,
          plan: "pro",
          settings: { ga4MeasurementId: GA4_ID, analyticsEnabled },
        }),
      ).toBeNull();
    }
  });

  it("returns null for a Basic tenant, and for an unreadable plan", () => {
    expect(
      storeGa4MeasurementId({ tenantId: TENANT, plan: "basic", settings: configured }),
    ).toBeNull();
    expect(
      storeGa4MeasurementId({ tenantId: TENANT, settings: configured }),
    ).toBeNull();
  });

  it("returns null when the stored id is not a measurement id", () => {
    expect(
      storeGa4MeasurementId({
        tenantId: TENANT,
        plan: "pro",
        settings: { ga4MeasurementId: "'+alert(1)+'", analyticsEnabled: true },
      }),
    ).toBeNull();
  });
});

describe("isGa4MeasurementId", () => {
  it("is the last check before the id reaches a script body", () => {
    expect(isGa4MeasurementId(GA4_ID)).toBe(true);
    // Nothing that could close the quote it is interpolated into.
    for (const bad of [
      "G-AB12'+alert(1)+'",
      'G-AB12";alert(1);"',
      "G-AB12</script>",
      "g-ab12cd34ef",
      "",
      null,
      undefined,
      123,
    ]) {
      expect(isGa4MeasurementId(bad)).toBe(false);
    }
  });
});

describe("analyticsConsentGranted", () => {
  const consent = (categories: Record<string, boolean>) =>
    `budstack_cookie_categories=${JSON.stringify(categories)}`;

  it("is true only once the visitor has accepted the analytics category", () => {
    expect(
      analyticsConsentGranted(
        consent({ analytics: true, marketing: false, preferences: false }),
      ),
    ).toBe(true);
    expect(
      analyticsConsentGranted(
        consent({ analytics: false, marketing: true, preferences: true }),
      ),
    ).toBe(false);
  });

  it("finds the cookie among others", () => {
    expect(
      analyticsConsentGranted(
        `foo=1; ${consent({ analytics: true })}; budstack_cookie_consent=true`,
      ),
    ).toBe(true);
  });

  it("is false with no cookie, an empty jar, or a malformed value — in every region", () => {
    for (const jar of [
      undefined,
      null,
      "",
      "budstack_cookie_consent=true",
      "budstack_cookie_categories=not-json",
      "budstack_cookie_categories=",
    ]) {
      expect(analyticsConsentGranted(jar)).toBe(false);
    }
  });

  it("is not fooled by a cookie whose name merely ends with the real one", () => {
    expect(
      analyticsConsentGranted(
        `evil_budstack_cookie_categories=${JSON.stringify({ analytics: true })}`,
      ),
    ).toBe(false);
  });
});
