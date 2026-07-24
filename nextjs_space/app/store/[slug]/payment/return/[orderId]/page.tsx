"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

type Status = "checking" | "paid" | "failed" | "unconfirmed";

// Customer lands here after returning from the PayCloud hosted checkout.
// PayCloud redirects to a single return_url regardless of outcome (no reliable
// status param), so we ask Dr Green for the DEFINITIVE status (a live
// order.query): paid → success and we clear the cart (the order is only really
// placed now); failed/cancelled/expired → a failure screen with Retry +
// Back-to-cart; still pending → keep polling, then a soft "not confirmed yet".
// The cart is cleared ONLY on a confirmed PAID, so a cancelled/failed payment
// keeps the cart intact for retry. "Back to cart" voids the unpaid order so it
// never lingers as placed-but-unpaid. We never re-charge here — the retry mint
// only works on a still-PENDING order.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // ~60s before a still-pending order is "not confirmed yet"
// After a decline, hold the retry button for a moment (US-009): instant
// re-attempts are what manufacture the gateway-side velocity that gets the
// NEXT attempt declined too. The backend also cools down mints server-side.
const RETRY_COOLDOWN_SECONDS = 15;

export default function PaymentReturnPage() {
    const params = useParams<{ slug: string; orderId: string }>();
    const slug = params.slug;
    const orderId = params.orderId;
    const clearCart = useCartStore((s) => s.clearCart);

    const [status, setStatus] = useState<Status>("checking");
    const [orderNumber, setOrderNumber] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [returning, setReturning] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [retryCooldown, setRetryCooldown] = useState(0);

    // Entering the failed state starts the retry cooldown countdown.
    useEffect(() => {
        if (status !== "failed") return;
        setRetryCooldown(RETRY_COOLDOWN_SECONDS);
        const timer = setInterval(() => {
            setRetryCooldown((s) => (s <= 1 ? 0 : s - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [status]);
    // Tenant hosts ({slug}.budstacks.io / custom domains) serve the store at
    // root; the apex serves it under /store/<slug>. Default to root (the live
    // tenant-host case) and correct to /store/<slug> on the apex after mount, so
    // the View-order / Back-to-cart links resolve on whichever host we're on.
    const [basePath, setBasePath] = useState("");
    useEffect(() => {
        if (window.location.pathname.startsWith(`/store/${slug}`)) {
            setBasePath(`/store/${slug}`);
        }
    }, [slug]);

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const poll = async () => {
            attempts += 1;
            try {
                const res = await fetch(
                    `/api/store/${slug}/orders/${orderId}/payment-status`,
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data?.orderNumber) setOrderNumber(data.orderNumber);
                    if (data?.state === "paid") {
                        if (!cancelled) {
                            clearCart(); // order is genuinely placed → safe to clear now
                            setStatus("paid");
                        }
                        return;
                    }
                    if (
                        data?.state === "failed" ||
                        data?.state === "cancelled" ||
                        data?.state === "expired"
                    ) {
                        if (!cancelled) setStatus("failed");
                        return;
                    }
                }
            } catch {
                // transient — keep polling
            }
            if (cancelled) return;
            if (attempts >= MAX_ATTEMPTS) {
                setStatus("unconfirmed");
                return;
            }
            setTimeout(poll, POLL_INTERVAL_MS);
        };

        poll();
        return () => {
            cancelled = true;
        };
    }, [slug, orderId, clearCart]);

    const handleRetry = async () => {
        setRetrying(true);
        setActionError(null);
        try {
            const res = await fetch(`/api/store/${slug}/orders/${orderId}/pay`, {
                method: "POST",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.payUrl) {
                window.location.href = data.payUrl;
                return; // leaving the page
            }
            if (res.ok && data?.paid) {
                clearCart();
                setStatus("paid");
                setRetrying(false);
                return;
            }
            setActionError(
                data?.error ||
                    data?.message ||
                    "We couldn't start the payment. Please try again.",
            );
        } catch {
            setActionError("Network error — please try again.");
        }
        setRetrying(false);
    };

    const handleBackToCart = async () => {
        setReturning(true);
        setActionError(null);
        // Void the unpaid order so it never lingers as placed-but-unpaid, then
        // return to the (still-intact) cart. Navigation isn't blocked on the
        // cancel succeeding — the TTL void cron retires it either way.
        try {
            await fetch(`/api/store/${slug}/orders/${orderId}/cancel`, {
                method: "POST",
            });
        } catch {
            // best-effort
        }
        window.location.href = `${basePath}/cart`;
    };

    const textColor = "hsl(var(--tenant-color-foreground, 222 47% 11%))";
    const mutedStyle = { color: textColor, opacity: 0.7 };
    const primaryBtnStyle = {
        backgroundColor: "hsl(var(--tenant-color-primary, 142 71% 45%))",
        color: "hsl(var(--tenant-color-primary-foreground, 0 0% 100%))",
    };

    // Shared retry + back-to-cart actions for the failed / unconfirmed screens.
    const recoveryActions = (
        <>
            {actionError && (
                <p className="mt-3 text-sm" style={{ color: "hsl(0 72% 51%)" }}>
                    {actionError}
                </p>
            )}
            <button
                type="button"
                onClick={handleRetry}
                disabled={retrying || returning || retryCooldown > 0}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60"
                style={primaryBtnStyle}
            >
                {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
                {retrying
                    ? "Starting payment…"
                    : retryCooldown > 0
                      ? `Try again in ${retryCooldown}s…`
                      : "Try payment again"}
            </button>
            <button
                type="button"
                onClick={handleBackToCart}
                disabled={retrying || returning}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium disabled:opacity-60"
                style={{ color: textColor, borderColor: "hsl(var(--tenant-color-border, 220 13% 91%))" }}
            >
                {returning && <Loader2 className="w-4 h-4 animate-spin" />}
                {returning ? "Returning…" : "Back to cart"}
            </button>
        </>
    );

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-20"
            style={{ backgroundColor: "hsl(var(--tenant-color-background, 0 0% 100%))" }}
        >
            <div
                className="w-full max-w-md rounded-2xl p-8 text-center shadow-sm"
                style={{
                    backgroundColor:
                        "hsl(var(--tenant-color-card, var(--tenant-color-background, 0 0% 100%)))",
                }}
            >
                {status === "checking" && (
                    <>
                        <Loader2
                            className="w-12 h-12 mx-auto animate-spin"
                            style={{ color: "hsl(var(--tenant-color-primary, 142 71% 45%))" }}
                        />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Confirming your payment…
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            This usually takes a few seconds. Please don&apos;t close this page.
                        </p>
                    </>
                )}

                {status === "paid" && (
                    <>
                        <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: "hsl(142 71% 45%)" }} />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Payment received
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            Thank you{orderNumber ? ` — order ${orderNumber}` : ""}. Your order is
                            being processed and you&apos;ll get an email as it ships.
                        </p>
                        <Link
                            href={`${basePath}/orders/${orderId}`}
                            className="mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-medium"
                            style={primaryBtnStyle}
                        >
                            View order
                        </Link>
                    </>
                )}

                {status === "failed" && (
                    <>
                        <XCircle className="w-12 h-12 mx-auto" style={{ color: "hsl(0 72% 51%)" }} />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Payment not completed
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            Your payment{orderNumber ? ` for order ${orderNumber}` : ""} didn&apos;t go
                            through, so the order hasn&apos;t been placed and you weren&apos;t charged.
                            Your cart is saved — try again, or head back to review it.
                        </p>
                        {recoveryActions}
                    </>
                )}

                {status === "unconfirmed" && (
                    <>
                        <AlertTriangle className="w-12 h-12 mx-auto" style={{ color: "hsl(38 92% 50%)" }} />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Payment not confirmed yet
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            We couldn&apos;t confirm your payment{orderNumber ? ` for order ${orderNumber}` : ""} in
                            time. If you completed it, it may still be clearing — we&apos;ll email you
                            once it&apos;s confirmed. Otherwise you can try again (you won&apos;t be
                            charged twice) or go back to your cart.
                        </p>
                        {recoveryActions}
                    </>
                )}
            </div>
        </div>
    );
}
