/**
 * SSRF egress guard for outbound webhook URLs.
 *
 * assertSafeWebhookUrl() rejects any URL that is not plain https or whose host
 * resolves to a non-public address (loopback, link-local incl. the cloud
 * metadata IP, RFC-1918, IPv6 unique-local/loopback) or an internal cloud
 * domain. Reference: OWASP SSRF Prevention Cheat Sheet. The DNS resolver is
 * injectable so callers (and tests) can avoid real network lookups.
 */

import { lookup } from "dns/promises";
import net from "net";

export type DnsResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: DnsResolver = (hostname) => lookup(hostname, { all: true });

/** Thrown when a webhook URL is rejected. `code` is a stable machine-readable reason. */
export class WebhookUrlError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "WebhookUrlError";
  }
}

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isBlockedIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)
  ) {
    return true; // unparseable -> block defensively
  }
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 ("this host")
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 10) return true; // RFC-1918 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC-1918 172.16.0.0/12
  if (a === 192 && b === 168) return true; // RFC-1918 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16 (incl. metadata)
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const norm = ip.toLowerCase();

  // IPv4-mapped / -compatible (e.g. ::ffff:10.0.0.5) -> apply the IPv4 rules.
  if (norm.includes(".")) {
    const v4 = norm.slice(norm.lastIndexOf(":") + 1);
    if (net.isIP(v4) === 4) return isBlockedIpv4(v4);
  }

  if (norm === "::1") return true; // loopback
  if (norm === "::") return true; // unspecified

  const firstHextet = norm.startsWith("::")
    ? 0
    : parseInt(norm.split(":")[0] || "0", 16);

  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true; // link-local fe80::/10
  if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) return true; // unique-local fc00::/7
  return false;
}

function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP -> block defensively
}

/**
 * Validate an outbound webhook URL against the SSRF blocklist. Resolves on
 * success; throws WebhookUrlError (with a stable `code`) on any rejection.
 */
export async function assertSafeWebhookUrl(
  url: string,
  resolver: DnsResolver = defaultResolver,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebhookUrlError("Webhook URL is not a valid URL", "invalid_url");
  }

  if (parsed.protocol !== "https:") {
    throw new WebhookUrlError("Webhook URL must use the https scheme", "scheme_blocked");
  }

  const host = stripBrackets(parsed.hostname.toLowerCase());

  // Internal-domain string check — independent of (and before) DNS.
  if (
    host === "localhost" ||
    host.endsWith(".railway.internal") ||
    host.endsWith(".internal")
  ) {
    throw new WebhookUrlError(
      `Webhook host targets an internal domain (${host})`,
      "internal_host_blocked",
    );
  }

  // Resolve the host to one or more IPs (unless it is already an IP literal).
  const addresses: string[] = [];
  if (net.isIP(host) !== 0) {
    addresses.push(host);
  } else {
    const resolved = await resolver(host);
    for (const entry of resolved) addresses.push(entry.address);
  }

  if (addresses.length === 0) {
    throw new WebhookUrlError(
      `Webhook host did not resolve to any address (${host})`,
      "dns_empty",
    );
  }

  // Reject if ANY resolved address is non-public (defends against DNS rebinding
  // returning a mix of public + internal IPs).
  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new WebhookUrlError(
        `Webhook host resolves to a blocked address (${addr})`,
        "ip_blocked",
      );
    }
  }
}
