import { describe, expect, it } from "vitest";
import { assertSafeWebhookUrl, type DnsResolver } from "@/lib/webhook-ssrf";

// The tenant-admin webhook routes are Clerk-auth protected, so the full HTTP
// E2E (PRD-211 §12) is deferred. These function-level cases lock the exact
// registration-time guard the POST/PATCH handlers now apply via the same
// assertSafeWebhookUrl call.

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("webhook registration SSRF validation", () => {
  it("rejects http://169.254.169.254/ (non-https + metadata IP)", async () => {
    await expect(
      assertSafeWebhookUrl("http://169.254.169.254/"),
    ).rejects.toThrow();
  });

  it("rejects a *.railway.internal URL", async () => {
    await expect(
      assertSafeWebhookUrl("https://hooks.foo.railway.internal/ingest"),
    ).rejects.toThrow();
  });

  it("accepts a public https URL", async () => {
    await expect(
      assertSafeWebhookUrl("https://hooks.example.com/ingest", publicResolver),
    ).resolves.toBeUndefined();
  });
});
