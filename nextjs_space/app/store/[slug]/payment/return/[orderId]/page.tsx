"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

type Status = "checking" | "paid" | "unconfirmed";

// Customer lands here after returning from the PayCloud hosted checkout.
// PayCloud redirects to a single return_url regardless of outcome (no reliable
// status param), and a payment is confirmed server-side via webhook + a
// reconciliation sweep — so we poll the order until it reads PAID and show
// success. If it never clears within the window the payment was most likely
// cancelled or declined (Dr Green has no FAILED status — it stays PENDING), so
// we show a "not confirmed" state with a Retry that re-mints a fresh checkout
// for the SAME order. We never re-charge from this page: the mint endpoint only
// works on a PENDING order, so an already-paid order can't be paid twice.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20; // ~60s before we treat it as not confirmed

export default function PaymentReturnPage() {
    const params = useParams<{ slug: string; orderId: string }>();
    const slug = params.slug;
    const orderId = params.orderId;
    const basePath = `/store/${slug}`;

    const [status, setStatus] = useState<Status>("checking");
    const [orderNumber, setOrderNumber] = useState<string | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const poll = async () => {
            attempts += 1;
            try {
                const res = await fetch(`/api/store/${slug}/orders/${orderId}`);
                if (res.ok) {
                    const { order } = await res.json();
                    if (order?.orderNumber) setOrderNumber(order.orderNumber);
                    if (order?.paymentStatus === "PAID") {
                        if (!cancelled) setStatus("paid");
                        return; // stop polling
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
    }, [slug, orderId]);

    const handleRetry = async () => {
        setRetrying(true);
        setRetryError(null);
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
                setStatus("paid");
                setRetrying(false);
                return;
            }
            setRetryError(
                data?.error ||
                    data?.message ||
                    "We couldn't start the payment. Please try again.",
            );
        } catch {
            setRetryError("Network error — please try again.");
        }
        setRetrying(false);
    };

    const textColor = "hsl(var(--tenant-color-foreground, 222 47% 11%))";
    const mutedStyle = { color: textColor, opacity: 0.7 };
    const primaryBtnStyle = {
        backgroundColor: "hsl(var(--tenant-color-primary, 142 71% 45%))",
        color: "hsl(var(--tenant-color-primary-foreground, 0 0% 100%))",
    };

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

                {status === "unconfirmed" && (
                    <>
                        <AlertTriangle className="w-12 h-12 mx-auto" style={{ color: "hsl(38 92% 50%)" }} />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Payment not confirmed
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            We couldn&apos;t confirm your payment{orderNumber ? ` for order ${orderNumber}` : ""}. If
                            you cancelled or it didn&apos;t go through, you can try again — you won&apos;t
                            be charged twice. If you already completed payment, it may still be
                            clearing; we&apos;ll email you once it&apos;s confirmed.
                        </p>

                        {retryError && (
                            <p className="mt-3 text-sm" style={{ color: "hsl(0 72% 51%)" }}>
                                {retryError}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleRetry}
                            disabled={retrying}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-60"
                            style={primaryBtnStyle}
                        >
                            {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
                            {retrying ? "Starting payment…" : "Try payment again"}
                        </button>

                        <Link
                            href={`${basePath}/orders/${orderId}`}
                            className="mt-3 inline-block text-sm font-medium underline"
                            style={{ color: textColor, opacity: 0.8 }}
                        >
                            View order status
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
