/**
 * Re-price the browser basket against the live catalogue (BS-F01).
 *
 * The basket lives in localStorage with the price captured at add-to-cart and
 * no TTL, so it can show a price Dr Green no longer charges — and with Dr
 * Green Commission Flex every KEY holder can move their storefront's price at
 * any time. Checkout therefore re-reads the tenant's own catalogue and shows
 * each line at the live price. Pure and client-safe: no I/O, no mutation of
 * the inputs.
 */
import type { CartItem } from "@/lib/cart-store";

/** One product from GET /api/store/[slug]/products, as checkout needs it. */
export interface LiveCatalogueProduct {
    id: string;
    price?: number;
    retailPrice?: number;
    currency?: string;
    isAvailable?: boolean;
    in_stock?: boolean;
}

export interface RepriceResult {
    /** The basket with live prices; unlisted/unavailable lines removed. */
    items: CartItem[];
    /** productIds whose stored price differed from the live price. */
    priceChanged: string[];
    /** Lines dropped because the product is no longer listed or available. */
    removed: CartItem[];
    /** True when anything differs from the input basket. */
    changed: boolean;
}

/** Prices are money: anything under half a cent is the same price. */
const PRICE_EPSILON = 0.005;

/**
 * The per-gram price the storefront shows for a product. Mirrors the product
 * card and the detail page (`product.price || product.retailPrice || 0`), so
 * checkout and the product pages can never disagree.
 */
export function livePriceOf(product: LiveCatalogueProduct): number {
    return product.price || product.retailPrice || 0;
}

/**
 * Orderable now: the order-submit route drops unavailable lines server-side,
 * and a price of 0 means "price unavailable", never a free product.
 */
function isOrderable(product: LiveCatalogueProduct): boolean {
    return (
        product.isAvailable !== false &&
        product.in_stock !== false &&
        livePriceOf(product) > 0
    );
}

export function repriceBasket(
    items: readonly CartItem[],
    catalogue: readonly LiveCatalogueProduct[],
): RepriceResult {
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    const kept: CartItem[] = [];
    const removed: CartItem[] = [];
    const priceChanged: string[] = [];

    for (const item of items) {
        const product = byId.get(item.productId);
        if (!product || !isOrderable(product)) {
            removed.push(item);
            continue;
        }
        const live = livePriceOf(product);
        const currency = product.currency || item.currency;
        const priceMoved = Math.abs(live - item.price) >= PRICE_EPSILON;
        if (priceMoved) priceChanged.push(item.productId);
        kept.push(
            priceMoved || currency !== item.currency
                ? { ...item, price: live, currency }
                : item,
        );
    }

    const changed =
        removed.length > 0 || kept.some((item, i) => item !== items[i]);
    return { items: kept, priceChanged, removed, changed };
}

/** Sum of price × grams — the same arithmetic as the cart store. */
export function basketSubtotal(items: readonly CartItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * A stable signature of WHAT is in the basket (not what it costs), so the
 * checkout re-prices when a line is added, removed or re-weighed, but writing
 * the live price back into the store does not trigger another fetch.
 */
export function basketSignature(items: readonly CartItem[]): string {
    return items
        .map((i) => `${i.productId}:${i.quantity}`)
        .sort()
        .join("|");
}
