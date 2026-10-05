"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import {
  basketSignature,
  repriceBasket,
  type LiveCatalogueProduct,
} from "@/lib/checkout/reprice-basket";

export type PricingStatus = "loading" | "live" | "unconfirmed";

export interface CheckoutPricing {
  /** "live" once the basket matches the tenant's live catalogue. */
  status: PricingStatus;
  /** productIds whose price was updated on this visit ("Price updated"). */
  updatedIds: ReadonlySet<string>;
  /** Names of lines removed because they are no longer listed. */
  removedNames: string[];
  /** Dr Green's delivery charge, or null when it has not quoted one. */
  deliveryCharge: number | null;
}

/**
 * BS-F01 — keep the checkout basket at the live catalogue price.
 *
 * Fetches the tenant's catalogue on load and whenever WHAT is in the basket
 * changes (not when only a price is written back, see basketSignature), writes
 * live prices into the basket store and drops lines no longer listed. The
 * delivery quote is read once: it is per market, not per basket.
 */
export function useCheckoutPricing(slug: string): CheckoutPricing {
  const items = useCartStore((s) => s.items);
  const replaceItems = useCartStore((s) => s.replaceItems);
  const signature = useMemo(() => basketSignature(items), [items]);

  const [status, setStatus] = useState<PricingStatus>("loading");
  const [updatedIds, setUpdatedIds] = useState<ReadonlySet<string>>(new Set());
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);

  useEffect(() => {
    if (!signature) {
      setStatus("live");
      return;
    }
    let cancelled = false;
    setStatus("loading");

    fetch(`/api/store/${slug}/products`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success || !Array.isArray(body.data)) {
          throw new Error("catalogue unavailable");
        }
        return body.data as LiveCatalogueProduct[];
      })
      .then((catalogue) => {
        if (cancelled) return;
        // Read the basket now, not when the effect started, so a change made
        // while the request was in flight is never overwritten.
        const result = repriceBasket(useCartStore.getState().items, catalogue);
        if (result.changed) replaceItems(result.items);
        if (result.priceChanged.length > 0) {
          setUpdatedIds(
            (prev) => new Set([...Array.from(prev), ...result.priceChanged]),
          );
        }
        if (result.removed.length > 0) {
          setRemovedNames((prev) => [
            ...prev,
            ...result.removed.map((r) => r.name),
          ]);
        }
        setStatus("live");
      })
      .catch(() => {
        // The order is still priced by Dr Green server-side; say we could not
        // confirm the price here rather than block the customer.
        if (!cancelled) setStatus("unconfirmed");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, signature, replaceItems]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/store/${slug}/checkout/quote`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const value = body?.deliveryCharge;
        if (!cancelled && typeof value === "number" && Number.isFinite(value)) {
          setDeliveryCharge(value);
        }
      })
      .catch(() => {
        /* no quote — checkout shows "calculated by Dr Green" */
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { status, updatedIds, removedNames, deliveryCharge };
}
