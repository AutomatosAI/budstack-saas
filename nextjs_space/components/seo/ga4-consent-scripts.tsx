"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { analyticsConsentGranted } from "@/lib/cookie-utils";
import { isGa4MeasurementId } from "@/lib/seo/site-verification";

/**
 * SEO Supercharge US-026 — the GA4 tag, and the visitor decision that gates it.
 *
 * WHY THE CONSENT CHECK IS ON THE CLIENT and not in the server component that
 * renders this: the store pages are cacheable (`app/store/[slug]/page.tsx`
 * declares `revalidate = 60`), so a decision made from one visitor's cookie
 * would be the decision baked into the HTML the next visitor gets. Consent is
 * per-visitor state the browser holds; it is read in the browser. What crosses
 * from the server is the store-level configuration only — an id and a nonce.
 *
 * STRICT, per the PRD's open question 3: nothing is loaded until the analytics
 * category is affirmatively consented to. No Consent Mode default-denied ping,
 * no cookieless pageview. Flipping to Consent Mode changes this component and
 * `analyticsConsentGranted`, and nothing else.
 *
 * The cookie is re-read on every navigation because this component is mounted
 * by the store LAYOUT, which survives client-side navigation — without the
 * pathname dependency, a visitor who accepts the banner would not be counted
 * until they next did a full page load.
 *
 * CSP (`middleware.ts:97-108`, `lib/security/csp.ts`): both tags carry the
 * per-request nonce. They are also injected client-side by next/script — i.e.
 * `document.createElement`, not the parser — so a CSP3 browser trusts them
 * transitively under 'strict-dynamic' whatever it makes of the nonce. The
 * googletagmanager/google-analytics hosts are on the store variant's
 * script-src/connect-src/img-src for CSP2 browsers and for the report hits,
 * which 'strict-dynamic' does not cover.
 *
 * NO SUBRESOURCE INTEGRITY, and it is not an oversight: gtag.js is generated
 * per measurement id and rebuilt continuously, so Google publishes no hash and
 * a pinned one would take the tag down on their next deploy. The controls that
 * do apply are the host allowlist above and the fact that the id interpolated
 * below cannot contain a quote (`isGa4MeasurementId`).
 */
export function Ga4ConsentScripts({
  measurementId,
  nonce,
}: {
  measurementId: string;
  nonce?: string;
}) {
  const pathname = usePathname();
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    setConsented(analyticsConsentGranted(document.cookie));
  }, [pathname]);

  // Re-checked HERE, immediately before the id is interpolated into a script
  // body, rather than trusted from the props. The server already validated it;
  // this is what makes the interpolation below safe to read in isolation — the
  // pattern admits no quote, backslash or angle bracket.
  if (!consented || !isGa4MeasurementId(measurementId)) return null;

  return (
    <>
      <Script
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`}
      </Script>
    </>
  );
}
