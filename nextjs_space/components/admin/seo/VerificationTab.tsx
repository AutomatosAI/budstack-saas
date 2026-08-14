"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

import {
  SITE_VERIFICATION_FIELDS,
  checkSiteVerificationField,
  type SiteVerificationKey,
} from "@/lib/seo/site-verification";

/**
 * SEO Supercharge US-026 — the Verification tab of the SEO Manager.
 *
 * THREE FIELDS, NOT A HEAD-HTML BOX. The section an owner expects here on other
 * platforms is a textarea that gets injected into `<head>`; this one refuses to
 * be that (see `lib/seo/site-verification.ts`), and says so, because "paste your
 * tag here" is the request this screen exists to answer safely.
 *
 * Rendered only for a tenant holding `seo.pro` (app/tenant-admin/seo/page.tsx);
 * a Basic tenant meets the locked card in the Pro tab instead. That is
 * PRESENTATION — the boundary is `requireFeature(FEATURES.SEO_PRO, …)` on the
 * PUT route, which 403s a Basic tenant whatever this component renders.
 *
 * Validation runs HERE against the same `SITE_VERIFICATION_FIELDS` contract the
 * route enforces, so a mistyped token is named before the round trip; the
 * server's own message is still shown verbatim when one comes back, since it is
 * the authority and the two could differ after a deploy.
 */

const API_PATH = "/api/tenant-admin/seo/verification";
const COOKIE_SETTINGS_PATH = "/tenant-admin/cookie-settings";

const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export type VerificationValues = Record<SiteVerificationKey, string>;

interface VerificationTabProps {
  initialValues: VerificationValues;
  /**
   * `tenants.settings.analyticsEnabled` — the store's own Analytics Cookies
   * switch. The GA4 tag stays dormant until it is on, so the field says so
   * rather than letting an owner watch an empty dashboard.
   */
  analyticsCookiesEnabled: boolean;
}

const FIELD_KEYS: ReadonlySet<string> = new Set(
  SITE_VERIFICATION_FIELDS.map((spec) => spec.key),
);

/**
 * The server's own rejection: its message, and the field it names when it named
 * one. A 400 from this route identifies the field it refused; a 403 (plan or
 * permission) and a 500 are about the request as a whole and get shown above the
 * button instead of pinned to an input.
 */
async function readError(
  response: Response,
): Promise<{ key: SiteVerificationKey | null; message: string }> {
  try {
    const body: unknown = await response.json();
    const { error, field } = (body ?? {}) as {
      error?: unknown;
      field?: unknown;
    };
    if (typeof error === "string" && error) {
      return {
        key:
          typeof field === "string" && FIELD_KEYS.has(field)
            ? (field as SiteVerificationKey)
            : null,
        message: error,
      };
    }
  } catch {
    // Non-JSON body (a proxy error page, an empty 500) — fall through.
  }
  return { key: null, message: "Could not save those settings. Try again." };
}

export function VerificationTab({
  initialValues,
  analyticsCookiesEnabled,
}: VerificationTabProps) {
  const [values, setValues] = useState<VerificationValues>(initialValues);
  const [fieldError, setFieldError] = useState<{
    key: SiteVerificationKey;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setError(null);
    setFieldError(null);
    setSaved(false);

    for (const spec of SITE_VERIFICATION_FIELDS) {
      const checked = checkSiteVerificationField(spec, values[spec.key]);
      if (!checked.ok) {
        setFieldError({ key: spec.key, message: checked.message });
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(API_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const rejection = await readError(response);
        if (rejection.key) {
          setFieldError({ key: rejection.key, message: rejection.message });
        } else {
          setError(rejection.message);
        }
        return;
      }

      const body: { verification?: VerificationValues } = await response.json();
      // The stored record wins over what was typed: the route normalises a
      // pasted meta tag down to its token, and the field should show what the
      // storefront will actually publish.
      if (body.verification) setValues(body.verification);
      setSaved(true);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bs-card bs-card-pad space-y-6">
      <div>
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          Verification &amp; analytics
        </h3>
        <p className="text-sm text-bs-fg-muted max-w-[640px]">
          Prove to Google and Bing that this store is yours, and connect Google
          Analytics. These are the three values those tools ask for — paste the
          value, or the whole meta tag they give you and we will take the value
          out of it. Nothing else is added to your pages.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {SITE_VERIFICATION_FIELDS.map((spec) => (
          <div key={spec.key} className="space-y-1.5">
            <label
              htmlFor={`verification-${spec.key}`}
              className="block text-xs font-medium text-bs-fg-muted"
            >
              {spec.label}
            </label>
            <input
              id={`verification-${spec.key}`}
              className={`bs-input font-mono text-sm w-full ${
                fieldError?.key === spec.key ? "border-bs-warn" : ""
              }`}
              placeholder={spec.placeholder}
              value={values[spec.key]}
              // Room for a pasted meta tag; the token inside it is what is
              // stored, and the route re-applies the real cap after extraction.
              maxLength={400}
              onChange={(event) => {
                const next = event.target.value;
                setSaved(false);
                setValues((prev) => ({ ...prev, [spec.key]: next }));
              }}
            />
            {fieldError?.key === spec.key && (
              <p className="text-xs text-bs-warn" role="alert">
                {fieldError.message}
              </p>
            )}
            {spec.key === "ga4MeasurementId" && !analyticsCookiesEnabled && (
              <p className="text-xs text-bs-fg-muted">
                Analytics Cookies are switched off for this store, so the tag
                will not load even once this is saved. Turn them on in{" "}
                <Link
                  href={COOKIE_SETTINGS_PATH}
                  className="underline hover:text-bs-fg"
                >
                  Cookie Settings
                </Link>
                . Visitors are still asked for consent, and nothing is loaded
                until they give it.
              </p>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="bs-btn bs-btn-green bs-btn-sm"
            disabled={saving}
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Save
          </button>
          {saved && !saving && (
            <span className="inline-flex items-center gap-1 text-sm text-bs-fg-muted">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Saved
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-bs-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
