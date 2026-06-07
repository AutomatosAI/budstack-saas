import { NextRequest } from "next/server";

/**
 * Origin verification for CSRF defense on state-changing API requests.
 *
 * Clerk session cookies are SameSite=Lax which gives baseline CSRF
 * protection for cross-site form submissions. This helper adds a second
 * layer by validating the Origin/Referer header matches an allowed host
 * before mutating state. Intended for POST/PATCH/PUT/DELETE handlers.
 *
 * Allowed hosts come from env (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BASE_URL)
 * plus the request's own host (so subdomain tenants self-validate).
 *
 * Webhooks should NOT use this — they originate from third parties and
 * have their own signature-based verification.
 */

function parseHostname(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getAllowedHostnames(req: NextRequest): Set<string> {
  const allowed = new Set<string>();

  const requestHost = req.headers.get("host")?.toLowerCase();
  if (requestHost) {
    // Strip port if present
    allowed.add(requestHost.split(":")[0]);
  }

  for (const envVar of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    const host = parseHostname(envVar || null);
    if (host) allowed.add(host);
  }

  return allowed;
}

/**
 * Returns true if the request's Origin (or Referer fallback) belongs to
 * an allowed hostname. State-changing handlers should reject false here
 * with a 403 before performing any mutation.
 *
 * In development, returns true when no Origin/Referer is present (e.g.
 * curl, server-to-server) to avoid breaking local tooling. In production,
 * a missing origin on a state-changing request is rejected.
 */
export function verifyOrigin(req: NextRequest): boolean {
  const allowed = getAllowedHostnames(req);
  const origin = parseHostname(req.headers.get("origin"));
  const referer = parseHostname(req.headers.get("referer"));

  const candidate = origin ?? referer;
  if (!candidate) {
    return process.env.NODE_ENV !== "production";
  }

  for (const host of allowed) {
    if (candidate === host || candidate.endsWith(`.${host}`)) {
      return true;
    }
  }
  return false;
}
