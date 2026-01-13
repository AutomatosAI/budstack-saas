/**
 * Rate limiting utility for API routes
 * Implements a fixed window rate limiter backed by Redis.
 */

import { NextResponse } from 'next/server';
import Redis from 'ioredis';

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
  const { maxRequests = 20, windowMs = 60000 } = config;
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = `rate-limit:${identifier}:${window}`;

  try {
    const redis = getRedisClient();
    const results = await redis
      .multi()
      .incr(key)
      .exec();

    const count = Number(results?.[0]?.[1] ?? 1);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }

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
    console.warn('[RateLimit] Redis error, allowing request:', error);
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
