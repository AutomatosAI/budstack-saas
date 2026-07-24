import { describe, expect, it } from "vitest";
import { getPublicClientIp, isPublicIp } from "@/lib/client-ip";

// PRD payment-decline-reduction US-008: the shopper's PUBLIC IP is forwarded
// to Dr Green as PayCloud's term_ip fraud hint. A private/forged/absent value
// must resolve to undefined (field omitted) — never break checkout, never
// trust a client-forgeable leftmost XFF hop.
describe("client-ip", () => {
  describe("isPublicIp", () => {
    it.each([
      "10.0.3.7",
      "::ffff:10.0.3.7",
      "172.16.0.1",
      "192.168.1.1",
      "127.0.0.1",
      "169.254.10.10",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "",
      "not-an-ip",
      "999.1.1.1",
    ])("rejects %s", (value) => {
      expect(isPublicIp(value)).toBe(false);
    });

    it.each([
      "41.13.10.20",
      "196.10.10.10",
      "172.15.0.1",
      "172.32.0.1",
      "::ffff:41.13.10.20",
      "2001:db8::1",
    ])("accepts %s", (value) => {
      expect(isPublicIp(value)).toBe(true);
    });
  });

  describe("getPublicClientIp", () => {
    const headersOf = (entries: Record<string, string>) =>
      new Headers(entries);

    it("prefers cf-connecting-ip (Cloudflare fronts the custom domains)", () => {
      expect(
        getPublicClientIp(
          headersOf({
            "cf-connecting-ip": "41.13.10.20",
            "x-real-ip": "196.1.1.1",
            "x-forwarded-for": "8.8.8.8",
          }),
        ),
      ).toBe("41.13.10.20");
    });

    it("falls back to x-real-ip when cf-connecting-ip is absent or private", () => {
      expect(
        getPublicClientIp(
          headersOf({
            "cf-connecting-ip": "10.0.0.1",
            "x-real-ip": "196.10.10.10",
          }),
        ),
      ).toBe("196.10.10.10");
    });

    it("scans x-forwarded-for right-to-left and takes the first PUBLIC hop (edge-appended, not forgeable)", () => {
      expect(
        getPublicClientIp(
          headersOf({
            // leftmost "1.2.3.4" is client-supplied garbage; the edge appended
            // the real client then an internal hop.
            "x-forwarded-for": "1.2.3.4, 41.13.10.20, 10.0.0.7",
          }),
        ),
      ).toBe("41.13.10.20");
    });

    it("unwraps ::ffff: IPv4-mapped hops", () => {
      expect(
        getPublicClientIp(
          headersOf({ "x-forwarded-for": "::ffff:41.13.10.20" }),
        ),
      ).toBe("41.13.10.20");
    });

    it("returns undefined when nothing public exists — the field is omitted, checkout proceeds", () => {
      expect(
        getPublicClientIp(
          headersOf({
            "x-real-ip": "10.0.0.5",
            "x-forwarded-for": "192.168.1.10, 10.0.0.7",
          }),
        ),
      ).toBe(undefined);
      expect(getPublicClientIp(headersOf({}))).toBe(undefined);
    });
  });
});
