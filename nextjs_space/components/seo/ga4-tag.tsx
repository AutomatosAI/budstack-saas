import { headers } from "next/headers";

import {
  storeGa4MeasurementId,
  type SiteVerificationSource,
} from "@/lib/seo/site-verification";
import { Ga4ConsentScripts } from "./ga4-consent-scripts";

/**
 * SEO Supercharge US-026 — the element that puts a store's GA4 tag in the page.
 *
 * Server component, and the same division of labour as `json-ld.tsx`: this half
 * resolves the STORE's configuration (plan, stored measurement id, the store's
 * own Analytics Cookies switch — see `storeGa4MeasurementId`) and reads the
 * per-request nonce; the client half it renders resolves the VISITOR's consent.
 * Neither can render the tag on its own.
 *
 * `headers()` is already read on this route by tenant resolution, so the nonce
 * read adds no dynamic-rendering constraint that was not there.
 */
export function Ga4Tag(source: SiteVerificationSource) {
  const measurementId = storeGa4MeasurementId(source);
  if (!measurementId) return null;

  return (
    <Ga4ConsentScripts
      measurementId={measurementId}
      nonce={headers().get("x-nonce") ?? undefined}
    />
  );
}
