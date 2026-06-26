/**
 * Direct-pay policy for Budstacks storefronts.
 *
 * Budstacks is direct-pay-first: customers pay upfront at checkout wherever a
 * payment provider is wired for their market. Today that's ZA/ZAR via Dr Green
 * PayCloud; other markets fall back to the email-link flow until their provider
 * is added — so the platform stays flexible as new countries/providers come on.
 * (Legacy WordPress partners never run this code and stay on email-link.)
 *
 * Controls (env, no deploy needed to flip):
 *   - DIRECT_PAY_MARKETS   comma-separated ISO alpha-2 markets (default "ZA")
 *   - DIRECT_PAY_DISABLED  set "true" to kill direct-pay platform-wide instantly
 */
const DEFAULT_DIRECT_PAY_MARKETS = "ZA";

function directPayMarkets(): Set<string> {
    return new Set(
        (process.env.DIRECT_PAY_MARKETS || DEFAULT_DIRECT_PAY_MARKETS)
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
    );
}

/**
 * Whether a tenant in this market should attempt upfront direct payment.
 * Returns false (→ email-link flow) when direct-pay is globally disabled, the
 * market has no provider wired yet, or no country is set.
 */
export function isDirectPaySupported(countryCode?: string | null): boolean {
    if (process.env.DIRECT_PAY_DISABLED === "true") return false;
    if (!countryCode) return false;
    return directPayMarkets().has(countryCode.toUpperCase());
}
