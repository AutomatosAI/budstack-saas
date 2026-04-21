/**
 * Dr. Green Client Cart ID Resolution
 *
 * clientCartId != clientId — the cart has its own UUID assigned by Dr Green.
 * Retrieved from GET /dapp/clients/{clientId} → data.clientCart[0].id
 *
 * Cached in Redis (5 min TTL) to avoid hitting Dr Green on every cart operation.
 * Invalidated after order placement (Dr Green may assign a new cart).
 */

import Redis from "ioredis";
import { fetchClient } from "@/lib/doctor-green-api";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = "drgreen:clientCartId:";

let redis: Redis | null = null;

function getRedis(): Redis | null {
    if (!REDIS_URL || REDIS_URL === "redis://localhost:6379") {
        // No Redis in dev — skip caching
        if (process.env.NODE_ENV === "development") return null;
    }
    if (!redis) {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
    }
    return redis;
}

/**
 * Get the clientCartId for a Dr Green client.
 * Checks Redis cache first, then fetches from Dr Green API.
 */
export async function getClientCartId(
    clientId: string,
    apiOpts: { apiKey: string; secretKey: string; baseUrl?: string },
): Promise<string | null> {
    const cacheKey = `${CACHE_PREFIX}${clientId}`;

    // Try cache first
    try {
        const r = getRedis();
        if (r) {
            const cached = await r.get(cacheKey);
            if (cached) {
                console.log(`[ClientCart] Cache HIT for ${clientId}: ${cached}`);
                return cached;
            }
        }
    } catch {
        // Cache miss or Redis error — continue to API
    }

    // Fetch from Dr Green API
    const clientCartId = await fetchClientCartIdFromAPI(clientId, apiOpts);

    // Cache the result
    if (clientCartId) {
        try {
            const r = getRedis();
            if (r) {
                await r.setex(cacheKey, CACHE_TTL_SECONDS, clientCartId);
                console.log(`[ClientCart] Cached ${clientId} → ${clientCartId} (${CACHE_TTL_SECONDS}s)`);
            }
        } catch {
            // Non-blocking — caching failure shouldn't break orders
        }
    }

    return clientCartId;
}

/**
 * Invalidate cached clientCartId (call after order placement).
 */
export async function invalidateClientCartId(clientId: string): Promise<void> {
    try {
        const r = getRedis();
        if (r) {
            await r.del(`${CACHE_PREFIX}${clientId}`);
            console.log(`[ClientCart] Invalidated cache for ${clientId}`);
        }
    } catch {
        // Non-blocking
    }
}

/**
 * Fetch clientCartId from Dr Green API.
 *
 * Delegates to fetchClient() which already handles both the /dapp/clients/{id}
 * 401 bug (via the bidirectional multi-page list scan) and the email fallback.
 * Previously this function only scanned page 1 of 200 — clients with older
 * records (or anyone past the first page) would fail with "cart not found",
 * surfacing as the misleading "complete your consultation" error.
 */
async function fetchClientCartIdFromAPI(
    clientId: string,
    apiOpts: { apiKey: string; secretKey: string; baseUrl?: string },
): Promise<string | null> {
    try {
        const client = await fetchClient(clientId, {
            apiKey: apiOpts.apiKey,
            secretKey: apiOpts.secretKey,
            apiUrl: apiOpts.baseUrl,
        });

        const cartArray = (client as any)?.clientCart;
        if (Array.isArray(cartArray) && cartArray.length > 0 && cartArray[0]?.id) {
            return cartArray[0].id;
        }

        console.warn(
            `[ClientCart] fetchClient returned no clientCart for ${clientId}`,
            { keys: client ? Object.keys(client) : [] }
        );
    } catch (e) {
        console.warn(
            `[ClientCart] fetchClient failed for ${clientId}:`,
            e instanceof Error ? e.message : e
        );
    }

    return null;
}
