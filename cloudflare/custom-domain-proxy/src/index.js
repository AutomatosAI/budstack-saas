/**
 * Cloudflare Worker — custom-domain reverse proxy for budstacks tenant domains.
 *
 * WHY: Railway routes by the HTTP `Host` header (not SNI) and only recognises
 * hostnames registered as Railway custom domains. External tenant domains
 * (e.g. lekkerweed.co.za) are served as Cloudflare-for-SaaS *custom hostnames*
 * on the budstacks.io zone and are deliberately NOT registered in Railway — that
 * sidesteps Railway's flaky per-hostname certs and the apex-CNAME limitation.
 * So this Worker rewrites `Host` → the canonical Railway origin and forwards the
 * real visitor hostname in `X-Original-Host` (gated by a shared secret), which
 * the Next.js middleware trusts for tenant resolution.
 *
 * Platform traffic (budstacks.io / *.budstacks.io) is proxied straight to
 * Railway by DNS and must never hit this Worker; the guard below is a safety net
 * in case a route is mis-scoped.
 *
 * Env:
 *   RAILWAY_ORIGIN   (var)    canonical Railway service domain, e.g.
 *                             budstack-saas-production.up.railway.app
 *   BASE_DOMAIN      (var)    platform apex — budstacks.io
 *   CF_PROXY_SECRET  (secret) shared with the Next.js app (CF_PROXY_SECRET env);
 *                             middleware only trusts X-Original-Host when it matches.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const originalHost = url.hostname.toLowerCase();

    // Safety net: platform hostnames are DNS-proxied straight to Railway and
    // resolve via the Host header — never rewrite them.
    const base = (env.BASE_DOMAIN || "budstacks.io").toLowerCase();
    if (originalHost === base || originalHost.endsWith(`.${base}`)) {
      return fetch(request);
    }

    const origin = env.RAILWAY_ORIGIN;
    const secret = env.CF_PROXY_SECRET;
    if (!origin || !secret) {
      return new Response("custom-domain proxy misconfigured", { status: 500 });
    }

    // Rewrite Host → Railway origin; carry the real hostname + secret so the
    // Next.js middleware can resolve the tenant (Railway overwrites Host and
    // X-Forwarded-Host, so the custom X-Original-Host header is the reliable one).
    url.hostname = origin;
    url.protocol = "https:";
    url.port = "";

    const proxied = new Request(url.toString(), request);
    proxied.headers.set("X-Original-Host", originalHost);
    proxied.headers.set("X-CF-Proxy-Secret", secret);

    return fetch(proxied, { redirect: "manual" });
  },
};
