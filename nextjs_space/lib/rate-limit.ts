/**
 * Rate limiting utility for API routes
 * Implements a sliding window rate limiter with 20 requests per minute per user
 */

import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// In production, use Redis or a distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

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
 * const rateLimitResult = checkRateLimit(session.user.id);
 * if (!rateLimitResult.success) {
 *   return rateLimitResult.response;
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {},
): { success: true } | { success: false; response: NextResponse } {
  const { maxRequests = 20, windowMs = 60000 } = config;
  const now = Date.now();
  const key = `rate-limit:${identifier}`;

  // Get or create entry
  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Create new window
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    return { success: true };
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(entry.resetAt).toISOString(),
          },
        },
      ),
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);

  return { success: true };
}

/**
 * Get current rate limit status for an identifier
 *
 * @param identifier - Unique identifier for the rate limit
 * @param config - Rate limit configuration
 * @returns Rate limit status information
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = {},
): {
  remaining: number;
  limit: number;
  reset: Date;
} {
  const { maxRequests = 20, windowMs = 60000 } = config;
  const now = Date.now();
  const key = `rate-limit:${identifier}`;

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    return {
      remaining: maxRequests,
      limit: maxRequests,
      reset: new Date(now + windowMs),
    };
  }

  return {
    remaining: Math.max(0, maxRequests - entry.count),
    limit: maxRequests,
    reset: new Date(entry.resetAt),
  };
}
