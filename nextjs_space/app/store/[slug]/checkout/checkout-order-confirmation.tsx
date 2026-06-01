"use client";

import Link from "next/link";
import { Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface OrderResult {
  orderId: string;
  orderNumber: string;
  drGreenOrderId: string;
  total: number;
}

export function CheckoutOrderConfirmation({
  orderResult,
  currency,
  basePath,
}: {
  orderResult: OrderResult;
  currency: string;
  basePath: string;
}) {
  const isLocalOrder =
    !orderResult.drGreenOrderId ||
    orderResult.drGreenOrderId.startsWith("LOCAL-");
  return (
      <div
        className="min-h-screen pt-36 pb-20"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div className="container mx-auto px-4 max-w-lg">
          <Card
            style={{
              backgroundColor: "hsl(var(--tenant-color-background))",
              borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
            }}
          >
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              {isLocalOrder ? (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: "hsl(38 92% 90%)" }}
                >
                  <Clock className="w-8 h-8" style={{ color: "hsl(38 80% 45%)" }} />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                  style={{ backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)" }}
                >
                  <CheckCircle2
                    className="w-8 h-8"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
              )}

              <div>
                <h2
                  className="text-xl font-bold"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  {isLocalOrder ? "Order Received" : "Order Confirmed"}
                </h2>
                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {isLocalOrder
                    ? "Your order has been received and saved. Our team will process it shortly."
                    : "Your order has been placed successfully."}
                </p>
              </div>

              <div
                className="rounded-lg p-4 text-left space-y-2"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
                }}
              >
                <div className="flex justify-between text-sm">
                  <span
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Order ID
                  </span>
                  <span
                    className="font-mono font-medium"
                    style={{
                      color: "hsl(var(--tenant-color-heading))",
                    }}
                  >
                    {orderResult.orderNumber}
                  </span>
                </div>
                {orderResult.total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      Total
                    </span>
                    <span
                      className="font-medium"
                      style={{
                        color: "hsl(var(--tenant-color-heading))",
                      }}
                    >
                      {currency}
                      {orderResult.total.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <p
                className="text-xs"
                style={{
                  color: "hsl(var(--tenant-color-text) / 0.6)",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                {isLocalOrder
                  ? "You'll receive a confirmation email once processed."
                  : "Tracking information will be sent to your email."}
              </p>

              <div className="pt-2 space-y-2">
                <Link href={`${basePath}/products`} className="block">
                  <Button
                    className="w-full text-white"
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Continue Shopping
                  </Button>
                </Link>
                <Link href={`${basePath}/orders/${orderResult.orderId}`} className="block">
                  <Button variant="outline" className="w-full">
                    View Order
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
