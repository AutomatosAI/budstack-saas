"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

type Status = "checking" | "paid" | "pending";

// Customer lands here after returning from the PayCloud hosted checkout. We
// poll the order (which syncs paymentStatus from Dr Green) until it reads PAID,
// then show success. PayCloud confirms server-side via webhook, so this is just
// the customer-facing confirmation — we never re-charge from this page.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 12; // ~36s before we fall back to "still confirming"

export default function PaymentReturnPage() {
    const params = useParams<{ slug: string; orderId: string }>();
    const slug = params.slug;
    const orderId = params.orderId;
    const basePath = `/store/${slug}`;

    const [status, setStatus] = useState<Status>("checking");
    const [orderNumber, setOrderNumber] = useState<string | null>(null);

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
                setStatus("pending");
                return;
            }
            setTimeout(poll, POLL_INTERVAL_MS);
        };

        poll();
        return () => {
            cancelled = true;
        };
    }, [slug, orderId]);

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

                {status === "pending" && (
                    <>
                        <Clock
                            className="w-12 h-12 mx-auto"
                            style={{ color: "hsl(var(--tenant-color-primary, 142 71% 45%))" }}
                        />
                        <h1 className="mt-6 text-xl font-semibold" style={{ color: textColor }}>
                            Still confirming your payment
                        </h1>
                        <p className="mt-2 text-sm" style={mutedStyle}>
                            This is taking a little longer than usual to clear. We&apos;ll email you
                            as soon as it&apos;s confirmed — there&apos;s no need to pay again.
                        </p>
                        <Link
                            href={`${basePath}/orders/${orderId}`}
                            className="mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-medium"
                            style={primaryBtnStyle}
                        >
                            View order status
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
