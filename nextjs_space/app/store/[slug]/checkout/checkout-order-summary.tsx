"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import type { CartItem } from "@/lib/cart-store";
import type { PricingStatus } from "./use-checkout-pricing";

const TEXT = {
  color: "hsl(var(--tenant-color-text))",
  fontFamily: "var(--tenant-font-base, sans-serif)",
};
const HEADING = {
  color: "hsl(var(--tenant-color-heading))",
  fontFamily: "var(--tenant-font-base, sans-serif)",
};

export const DELIVERY_UNQUOTED_LABEL = "Calculated by Dr Green";

function money(currency: string, value: number): string {
  return `${currency}${value.toFixed(2)}`;
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={TEXT}>{label}</span>
      <span
        className={strong ? "text-lg font-bold" : "font-medium"}
        style={
          strong
            ? {
                color: "hsl(var(--tenant-color-primary))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }
            : HEADING
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Checkout order summary (BS-F01): each line at the live catalogue price,
 * subtotal, Dr Green's delivery charge and the total. Prices are shown as they
 * are — no was/now, badge or percentage (Dr Green Flex PRD non-goals).
 */
export function CheckoutOrderSummary({
  items,
  currency,
  subtotal,
  deliveryCharge,
  pricingStatus,
  updatedIds,
  removedNames,
}: {
  items: CartItem[];
  currency: string;
  subtotal: number;
  deliveryCharge: number | null;
  pricingStatus: PricingStatus;
  updatedIds: ReadonlySet<string>;
  removedNames: string[];
}) {
  const total = subtotal + (deliveryCharge ?? 0);

  return (
    <Card
      className="sticky top-24"
      style={{
        backgroundColor: "hsl(var(--tenant-color-background))",
        borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
      }}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className="text-base"
          style={{
            color: "hsl(var(--tenant-color-heading))",
            fontFamily: "var(--tenant-font-heading, sans-serif)",
          }}
        >
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {removedNames.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              {removedNames.join(", ")}{" "}
              {removedNames.length === 1 ? "is" : "are"} no longer available
              and {removedNames.length === 1 ? "was" : "were"} removed from
              your basket.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="truncate pr-2" style={TEXT}>
                {item.name} ({item.quantity}g)
                {updatedIds.has(item.productId) && (
                  <span
                    className="block text-xs"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  >
                    Price updated
                  </span>
                )}
              </span>
              <span className="font-medium whitespace-nowrap" style={HEADING}>
                {money(currency, item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        <Row label="Subtotal" value={money(currency, subtotal)} />
        <Row
          label="Delivery"
          value={
            deliveryCharge === null
              ? DELIVERY_UNQUOTED_LABEL
              : money(currency, deliveryCharge)
          }
        />
        <Row
          label={deliveryCharge === null ? "Total (excl. delivery)" : "Total"}
          value={money(currency, total)}
          strong
        />

        {pricingStatus === "unconfirmed" && (
          <p className="text-xs" style={TEXT}>
            We could not confirm today&apos;s prices. Your order will be
            charged at the store&apos;s current price.
          </p>
        )}

        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
            border: "1px solid hsl(var(--tenant-color-primary) / 0.12)",
          }}
        >
          <p className="text-xs leading-relaxed" style={TEXT}>
            Payment instructions will be sent after your order is placed.
            Crypto and card options available.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
