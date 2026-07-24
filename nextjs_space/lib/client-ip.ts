/**
 * Resolve the shopper's public IP from an incoming storefront request, to
 * forward to Dr Green as the PayCloud `term_ip` fraud hint (PRD
 * payment-decline-reduction US-008). Without it, direct-pay transactions are
 * attributed to this server's egress IP and the customer is scored against a
 * shared address — the mechanism behind the CyberSource velocity/morph
 * declines.
 *
 * This is a best-effort RISK HINT only — never used for auth, rate limiting
 * or auditing. When nothing public can be determined the caller simply omits
 * the field and checkout proceeds (Dr Green ignores bad hints server-side
 * too).
 *
 * Header preference:
 *  1. `cf-connecting-ip` — Cloudflare fronts the custom storefront domains
 *     (healingbuds/lekkerweed/budstacks.io zones) and overwrites this header
 *     with the real client, so it cannot be forged end-to-end.
 *  2. `x-real-ip` — set by the Railway edge.
 *  3. `x-forwarded-for`, scanned RIGHT to LEFT — the rightmost hop was
 *     appended by the trusted edge; leftmost entries are client-supplied and
 *     forgeable. The first public hop from the right is the client's egress.
 */
export function getPublicClientIp(headers: Headers): string | undefined {
  const direct = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
  ];
  for (const candidate of direct) {
    if (candidate && isPublicIp(candidate)) return normalizeIp(candidate);
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      if (isPublicIp(hops[i])) return normalizeIp(hops[i]);
    }
  }
  return undefined;
}

/** Strip an IPv4-mapped IPv6 prefix (`::ffff:1.2.3.4` → `1.2.3.4`). */
export function normalizeIp(value: string): string {
  const trimmed = value.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * True only for a syntactically valid, globally routable unicast address —
 * RFC1918, loopback, link-local, CGNAT, multicast and their IPv6 relatives
 * are all rejected (an internal hop must never become the fraud hint).
 */
export function isPublicIp(value: string | null | undefined): boolean {
  if (!value) return false;
  const ip = normalizeIp(value);

  const match = IPV4_PATTERN.exec(ip);
  if (match) {
    const o = match.slice(1, 5).map(Number);
    if (!o.every((n) => n >= 0 && n <= 255)) return false;
    return !(
      o[0] === 10 ||
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) ||
      o[0] === 127 ||
      (o[0] === 169 && o[1] === 254) ||
      (o[0] === 100 && o[1] >= 64 && o[1] <= 127) ||
      o[0] === 0 ||
      o[0] >= 224
    );
  }

  if (ip.includes(":") && /^[0-9a-f:]+$/i.test(ip) && ip.length >= 3) {
    const lower = ip.toLowerCase();
    return !(
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return false;
}
