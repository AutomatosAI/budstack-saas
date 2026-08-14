import { FEATURES, hasFeature } from "./features";

/**
 * Turning the chatbot ON requires the entitlement. Keeping an already-on
 * toggle on (a grandfathered tenant saving unrelated settings after
 * lockdown) and switching OFF are always allowed — the storefront gate
 * stops rendering for unentitled tenants regardless of the stored flag.
 */
export function chatbotEnableForbidden(
  requested: boolean | undefined,
  current: boolean,
  features: Iterable<string>,
): boolean {
  return (
    requested === true &&
    !current &&
    !hasFeature(features, FEATURES.AUTOMATOS_CHATBOT)
  );
}
