/**
 * In-memory cache of a tenant's normalised Dr Green catalogue, used by
 * fetchProduct so a product page does not re-fetch the whole list (BS-F03).
 *
 * Entries are keyed by the API key that fetched them. With Dr Green
 * Commission Flex the catalogue a key receives carries THAT key's price, so a
 * key-less entry would serve one tenant's price on another tenant's product
 * page (metadata and JSON-LD Offer.price) for up to the TTL. Tenants on the
 * platform-key fallback share the platform key's entry, which is correct:
 * they are served the platform key's price.
 *
 * The key holds a SHA-256 prefix of the API key, never the key itself.
 */
import { createHash } from "crypto";

const PRODUCT_CACHE_TTL_MS = 60 * 1000; // 60s — short, and busted on Dr Green strain/inventory webhooks

interface CacheEntry<T> {
    products: T[];
    expiresAt: number;
}

const productCache = new Map<string, CacheEntry<unknown>>();

/** A stable, non-reversible id for the key that fetched a catalogue. */
export function tenantKeyId(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

export function productCacheKey(
    country: string,
    config: { apiKey: string; apiUrl?: string },
): string {
    return `${tenantKeyId(config.apiKey)}:${country}:${config.apiUrl}`;
}

export function getCachedProducts<T>(key: string, now = Date.now()): T[] | null {
    const entry = productCache.get(key);
    return entry && entry.expiresAt > now ? (entry.products as T[]) : null;
}

export function setCachedProducts<T>(key: string, products: T[], now = Date.now()): void {
    productCache.set(key, { products, expiresAt: now + PRODUCT_CACHE_TTL_MS });
}

/**
 * Clear the in-memory product cache — every tenant's entry. Called from the
 * Dr Green webhook so a strain/inventory change (including a strain recreated
 * with a new id) is reflected immediately instead of after the TTL.
 */
export function invalidateProductCache(): void {
    productCache.clear();
}
