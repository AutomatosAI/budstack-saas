/**
 * Which delivery charge checkout shows (BS-F01). Pure and client-safe.
 *
 * Dr Green bills a per-market delivery charge on top of the line items. Two
 * sources can tell checkout what it is:
 *   1. the catalogue — `deliveryCharge` on each product, from the market's
 *      location row on GET /dapp/strains (normalizeProduct);
 *   2. the customer's Dr Green server cart (GET /api/store/[slug]/checkout/quote),
 *      which only exists while that cart holds items — the fallback.
 * A charge is shown only when quoted in the basket's own currency; otherwise
 * checkout keeps "Calculated by Dr Green".
 */
import type { CartItem } from "@/lib/cart-store";
import type { LiveCatalogueProduct } from "@/lib/checkout/reprice-basket";

export interface DeliveryChargeQuote {
    charge: number;
    /** Display symbol of the charge's currency, compared to the basket's. */
    symbol: string;
}

function isCharge(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * The catalogue's delivery charge for the basket, or null when any basket
 * line's product does not carry one or two lines disagree (they are one
 * market, so a disagreement means the data cannot be trusted).
 */
export function catalogueDeliveryQuote(
    items: readonly CartItem[],
    catalogue: readonly LiveCatalogueProduct[],
): DeliveryChargeQuote | null {
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    let quote: DeliveryChargeQuote | null = null;
    for (const item of items) {
        const product = byId.get(item.productId);
        const charge = product?.deliveryCharge;
        const symbol = product?.deliveryCurrency;
        if (!isCharge(charge) || typeof symbol !== "string" || !symbol) return null;
        if (quote && (quote.charge !== charge || quote.symbol !== symbol)) return null;
        quote = { charge, symbol };
    }
    return quote;
}

/**
 * The first quote (in priority order) in the basket's currency, else null.
 */
export function deliveryChargeForBasket(
    basketCurrency: string | undefined,
    quotes: ReadonlyArray<DeliveryChargeQuote | null>,
): number | null {
    if (!basketCurrency) return null;
    const match = quotes.find(
        (q) => q !== null && isCharge(q.charge) && q.symbol === basketCurrency,
    );
    return match ? match.charge : null;
}
