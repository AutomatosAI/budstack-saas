import { describe, expect, it, vi } from "vitest";

/**
 * A pay-upfront (DIRECT) order whose checkout could not be minted is a FAILED
 * checkout, not a placed order.
 *
 * 2026-07-29, LekkerWeed: a production backend task exited mid-request, the ALB
 * returned a 502 in 87ms, and the mint threw. The catch swallowed it, execution
 * continued to log('SUCCESS'), and the storefront — seeing no payUrl — showed
 * the order-confirmation screen AND called clearCart(). The customer was told
 * her order was placed, lost her basket, and no payment was ever taken. Dr Green
 * order ccdeea34 sat PENDING with stock committed.
 *
 * These tests pin the two halves of the contract:
 *   - transient mint failures are retried rather than stranding the order
 *   - an unminted DIRECT order reports paymentStartFailed so the storefront can
 *     tell the truth. On email-link stores the same shape is normal and the
 *     flag must stay false.
 */

// Mirrors the retry/report logic in
// app/api/store/[slug]/orders/submit/route.ts so the behaviour is pinned
// without standing up the full Next route (DB, Clerk, tenant resolution).
async function mintWithRetry(
  mint: () => Promise<{ payUrl: string }>,
  directPayEnabled: boolean,
  sleep: (ms: number) => Promise<void> = async () => {},
): Promise<{ payUrl?: string; paymentStartFailed: boolean; attempts: number }> {
  let payUrl: string | undefined;
  let paymentStartFailed = false;
  let attempts = 0;
  if (directPayEnabled) {
    const MINT_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MINT_ATTEMPTS; attempt++) {
      attempts = attempt;
      try {
        payUrl = (await mint()).payUrl;
        break;
      } catch {
        if (attempt !== MINT_ATTEMPTS) {
          await sleep(400 * attempt);
          continue;
        }
        paymentStartFailed = true;
      }
    }
  }
  return { payUrl, paymentStartFailed, attempts };
}

describe("direct-pay checkout — never report a placed order without payment", () => {
  it("retries a transient mint failure and succeeds (the 502 case)", async () => {
    const mint = vi
      .fn()
      .mockRejectedValueOnce(new Error("502 Bad Gateway"))
      .mockResolvedValue({ payUrl: "https://pay/abc" });

    const r = await mintWithRetry(mint, true);

    expect(r.payUrl).toBe("https://pay/abc");
    expect(r.paymentStartFailed).toBe(false);
    expect(r.attempts).toBe(2);
  });

  it("gives up after 3 attempts and flags paymentStartFailed", async () => {
    const mint = vi.fn().mockRejectedValue(new Error("502 Bad Gateway"));

    const r = await mintWithRetry(mint, true);

    expect(r.payUrl).toBeUndefined();
    expect(r.paymentStartFailed).toBe(true);
    expect(mint).toHaveBeenCalledTimes(3);
  });

  it("does NOT flag email-link stores — an unminted order is correct there", async () => {
    const mint = vi.fn();

    const r = await mintWithRetry(mint, false);

    expect(mint).not.toHaveBeenCalled();
    expect(r.payUrl).toBeUndefined();
    expect(r.paymentStartFailed).toBe(false);
  });

  it("a successful first attempt does not retry", async () => {
    const mint = vi.fn().mockResolvedValue({ payUrl: "https://pay/xyz" });

    const r = await mintWithRetry(mint, true);

    expect(r.attempts).toBe(1);
    expect(r.paymentStartFailed).toBe(false);
  });
});

describe("storefront response handling", () => {
  // Mirrors app/store/[slug]/checkout/page.tsx.
  const decide = (order: { payUrl?: string; paymentStartFailed?: boolean }) => {
    if (order.payUrl) return "redirect-to-pay";
    if (order.paymentStartFailed) return "show-error-keep-cart";
    return "show-confirmation-clear-cart";
  };

  it("redirects to payment when minted", () => {
    expect(decide({ payUrl: "https://pay/abc" })).toBe("redirect-to-pay");
  });

  it("keeps the cart and shows an error when payment could not start", () => {
    // Previously: 'show-confirmation-clear-cart' — the LekkerWeed bug.
    expect(decide({ paymentStartFailed: true })).toBe("show-error-keep-cart");
  });

  it("still confirms an email-link order, which has no payUrl by design", () => {
    expect(decide({ paymentStartFailed: false })).toBe(
      "show-confirmation-clear-cart",
    );
  });
});
