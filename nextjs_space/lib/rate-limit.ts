/**
 * Rate limiting utility for API routes
 * Implements a fixed window rate limiter backed by Redis.
 */

import { NextResponse } from 'next/server';
import Redis from 'ioredis';
import { apiError } from '@/lib/api-error';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: Redis | null = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisClient;
};

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   * @default 20
   */
  maxRequests?: number;
  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  windowMs?: number;
  /**
   * What to do when the Redis backend is unreachable.
   * - "open" (default): allow the request through — availability beats
   *   enforcement for public reads where blocking real users is worse than
   *   a brief lapse in metering.
   * - "closed": reject with 503 — enforcement beats availability for
   *   auth/write-adjacent endpoints where an unmetered flood is the bigger
   *   risk. US-010 opts specific call sites into this.
   *
   * Either way the Redis failure emits an `ops.rate_limit_failopen` event so
   * the outage is observable.
   * @default "open"
   */
  failMode?: 'open' | 'closed';
}

/**
 * Rate limit checker for API routes
 *
 * @param identifier - Unique identifier for the rate limit (typically user ID)
 * @param config - Rate limit configuration
 * @returns Object with success boolean and response (if rate limited)
 *
 * @example
 * ```ts
 * const rateLimitResult = await checkRateLimit(session.user.id);
 * if (!rateLimitResult.success) {
 *   return rateLimitResult.response;
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const { maxRequests = 20, windowMs = 60000, failMode = 'open' } = config;
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = `rate-limit:${identifier}:${window}`;

  try {
    const redis = getRedisClient();
    const results = await redis
      .multi()
      .incr(key)
      .pexpire(key, windowMs)
      .exec();

    const count = Number(results?.[0]?.[1] ?? 1);

    const ttlMs = await redis.pttl(key);
    const retryAfter = Math.max(0, Math.ceil(ttlMs / 1000));

    if (count > maxRequests) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(now + ttlMs).toISOString(),
            },
          }
        ),
      };
    }
  } catch (error) {
    // Redis is unreachable. Emit a structured ops event so the outage is
    // observable now — PRD-215 will formalise the transport; for today a
    // single keyed console.error line is the contract.
    console.error('ops.rate_limit_failopen', {
      identifier,
      failMode,
      error: error instanceof Error ? error.message : String(error),
    });

    if (failMode === 'closed') {
      // Enforcement beats availability here: reject rather than wave through
      // an unmetered flood. 503 + Retry-After via the vetted apiError
      // envelope so no raw Redis error text reaches the client.
      const retryAfter = Math.max(1, Math.ceil(windowMs / 1000));
      const response = apiError(new Error('Rate limiter backend unavailable'), {
        route: 'rate-limit',
        status: 503,
        safeMessage: 'Service temporarily unavailable. Please retry shortly.',
        logContext: { identifier, failMode },
      });
      response.headers.set('Retry-After', retryAfter.toString());
      return { success: false, response };
    }

    // failMode 'open' (default): availability wins — allow the request
    // through. Blocking legitimate users is worse than a brief metering lapse.
    return { success: true };
  }

  return { success: true };
}

/**
 * Get current rate limit status for an identifier
 *
 * @param identifier - Unique identifier for the rate limit
 * @param config - Rate limit configuration
 * @returns Rate limit status information
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = {}
): Promise<{
  remaining: number;
  limit: number;
  reset: Date;
}> {
  const { maxRequests = 20, windowMs = 60000 } = config;
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = `rate-limit:${identifier}:${window}`;

  try {
    const redis = getRedisClient();
    const [countValue, ttlMs] = await Promise.all([
      redis.get(key),
      redis.pttl(key),
    ]);

    const count = Number(countValue || 0);

    return {
      remaining: Math.max(0, maxRequests - count),
      limit: maxRequests,
      reset: new Date(now + (ttlMs > 0 ? ttlMs : windowMs)),
    };
  } catch (error) {
    console.warn('[RateLimit] Redis error, returning default window:', error);
    return {
      remaining: maxRequests,
      limit: maxRequests,
      reset: new Date(now + windowMs),
    };
  }
}
