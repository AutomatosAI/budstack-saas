import { describe, expect, it, vi } from "vitest";
import {
  assertSafeWebhookUrl,
  WebhookUrlError,
  type DnsResolver,
} from "@/lib/integrations/webhook-ssrf";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];
const privateResolver: DnsResolver = async () => [
  { address: "10.0.0.5", family: 4 },
];
const mixedResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
  { address: "169.254.169.254", family: 4 },
];

describe("assertSafeWebhookUrl", () => {
  it("accepts a normal public https URL (mock lookup to a public IP)", async () => {
    await expect(
      assertSafeWebhookUrl("https://example.com/webhook", publicResolver),
    ).resolves.toBeUndefined();
  });

  it("rejects a non-https scheme", async () => {
    await expect(
      assertSafeWebhookUrl("http://example.com", publicResolver),
    ).rejects.toBeInstanceOf(WebhookUrlError);
  });

  it("rejects a loopback IPv4 literal", async () => {
    await expect(assertSafeWebhookUrl("https://127.0.0.1")).rejects.toThrow(
      WebhookUrlError,
    );
  });

  it("rejects the cloud metadata / link-local address", async () => {
    await expect(
      assertSafeWebhookUrl("https://169.254.169.254"),
    ).rejects.toThrow(WebhookUrlError);
  });

  it("rejects an RFC-1918 host that resolves to a private IP (mock lookup)", async () => {
    await expect(
      assertSafeWebhookUrl("https://internal.example.com", privateResolver),
    ).rejects.toThrow(WebhookUrlError);
  });

  it("rejects an RFC-1918 IPv4 literal", async () => {
    await expect(assertSafeWebhookUrl("https://10.0.0.5")).rejects.toThrow(
      WebhookUrlError,
    );
  });

  it("rejects a *.railway.internal host before any DNS lookup", async () => {
    const resolver = vi.fn(publicResolver);
    await expect(
      assertSafeWebhookUrl("https://foo.railway.internal", resolver),
    ).rejects.toThrow(WebhookUrlError);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("rejects an IPv6 loopback literal", async () => {
    await expect(assertSafeWebhookUrl("https://[::1]")).rejects.toThrow(
      WebhookUrlError,
    );
  });

  it("rejects when ANY resolved address is private (rebinding defense)", async () => {
    await expect(
      assertSafeWebhookUrl("https://rebind.example.com", mixedResolver),
    ).rejects.toThrow(WebhookUrlError);
  });

  it("rejects a malformed URL", async () => {
    await expect(assertSafeWebhookUrl("not a url")).rejects.toThrow(
      WebhookUrlError,
    );
  });

  it("surfaces a stable error code on rejection", async () => {
    await expect(
      assertSafeWebhookUrl("http://example.com", publicResolver),
    ).rejects.toMatchObject({ code: "scheme_blocked" });
  });
});
