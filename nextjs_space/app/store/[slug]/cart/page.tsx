"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Trash2,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCartStore, WEIGHT_OPTIONS } from "@/lib/cart-store";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getTenantBasePath } from "@/lib/tenant-utils";

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const basePath = getTenantBasePath(slug);
  const { items, updateQuantity, removeItem, getTotalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotal = getTotalPrice();
  const currency = items[0]?.currency || "R";

  if (items.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center py-20 px-4"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div className="max-w-md w-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: "hsl(var(--tenant-color-primary) / 0.08)" }}
          >
            <ShoppingBag
              className="w-10 h-10"
              style={{ color: "hsl(var(--tenant-color-primary) / 0.4)" }}
            />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
          >
            Your cart is empty
          </h2>
          <p
            className="mb-8"
            style={{
              color: "hsl(var(--tenant-color-text))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
          >
            Looks like you haven&apos;t added any products to your cart yet.
          </p>
          <Link href={basePath || "/"}>
            <Button
              className="w-full text-white"
              style={{
                backgroundColor: "hsl(var(--tenant-color-primary))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pt-36 pb-20"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            style={{ color: "hsl(var(--tenant-color-text))" }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
          >
            Your Cart
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card
                    style={{
                      borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-semibold truncate"
                            style={{
                              color: "hsl(var(--tenant-color-heading))",
                              fontFamily: "var(--tenant-font-heading, sans-serif)",
                            }}
                          >
                            {item.name}
                          </h3>
                          <p
                            className="text-sm mt-0.5"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            {currency}
                            {item.price.toFixed(2)} per gram
                          </p>
                        </div>

                        {/* Weight selector (2g, 5g, 10g) */}
                        <div
                          className="flex items-center gap-1 rounded-lg p-1"
                          style={{
                            backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
                          }}
                        >
                          {WEIGHT_OPTIONS.map((w) => (
                            <Button
                              key={w}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5 text-xs font-bold rounded-md"
                              style={{
                                backgroundColor:
                                  item.quantity === w
                                    ? "hsl(var(--tenant-color-primary))"
                                    : "transparent",
                                color:
                                  item.quantity === w
                                    ? "white"
                                    : "hsl(var(--tenant-color-text))",
                              }}
                              onClick={() =>
                                updateQuantity(item.productId, w)
                              }
                            >
                              {w}g
                            </Button>
                          ))}
                        </div>

                        {/* Price + remove */}
                        <div className="flex items-center gap-3">
                          <span
                            className="font-bold whitespace-nowrap"
                            style={{
                              color: "hsl(var(--tenant-color-heading))",
                              fontFamily: "var(--tenant-font-heading, sans-serif)",
                            }}
                          >
                            {currency}
                            {(item.price * item.quantity).toFixed(2)}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => removeItem(item.productId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card
              className="sticky top-24"
              style={{
                borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
              }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck
                    className="w-5 h-5"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--tenant-font-heading, sans-serif)",
                    }}
                  >
                    Order Summary
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-sm">
                      <span
                        className="truncate pr-2"
                        style={{
                          color: "hsl(var(--tenant-color-text))",
                          fontFamily: "var(--tenant-font-base, sans-serif)",
                        }}
                      >
                        {item.name} ({item.quantity}g)
                      </span>
                      <span
                        className="font-medium whitespace-nowrap"
                        style={{
                          color: "hsl(var(--tenant-color-heading))",
                          fontFamily: "var(--tenant-font-base, sans-serif)",
                        }}
                      >
                        {currency}
                        {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Shipping
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    Calculated at checkout
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span
                    className="font-semibold"
                    style={{
                      color: "hsl(var(--tenant-color-heading))",
                      fontFamily: "var(--tenant-font-heading, sans-serif)",
                    }}
                  >
                    Total
                  </span>
                  <span
                    className="text-xl font-bold"
                    style={{
                      color: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-heading, sans-serif)",
                    }}
                  >
                    {currency}
                    {subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  <Button
                    className="w-full h-11 text-sm font-semibold text-white"
                    size="lg"
                    onClick={() => router.push(`${basePath}/checkout`)}
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceed to Checkout
                  </Button>

                  <div
                    className="rounded-lg p-3 flex gap-2 items-start"
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
                      border: "1px solid hsl(var(--tenant-color-primary) / 0.12)",
                    }}
                  >
                    <AlertCircle
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{ color: "hsl(var(--tenant-color-primary))" }}
                    />
                    <p
                      className="text-xs leading-relaxed"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      Secure checkout. Your eligibility will be verified before
                      the order is processed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
