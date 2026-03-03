"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  CreditCard,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { getTenantBasePath } from "@/lib/tenant-utils";
import { getUserShippingAddress, type ShippingAddress } from "@/app/actions/get-user-shipping";

interface OrderResult {
  orderId: string;
  orderNumber: string;
  drGreenOrderId: string;
  total: number;
}

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const basePath = getTenantBasePath(params.slug);
  const { items, getTotalPrice, clearCart } = useCartStore();

  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  // Saved address state
  const [savedAddress, setSavedAddress] = useState<ShippingAddress | null>(null);
  const [addressMode, setAddressMode] = useState<"saved" | "custom">("custom");
  const [loadingAddress, setLoadingAddress] = useState(true);

  const [formData, setFormData] = useState({
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  useEffect(() => {
    setMounted(true);

    const fetchAddress = async () => {
      try {
        const address = await getUserShippingAddress();
        if (address && address.address1) {
          setSavedAddress(address);
          setAddressMode("saved");
          setFormData({
            address1: address.address1,
            address2: address.address2 || "",
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
          });
        }
      } catch (err) {
        console.error("Failed to fetch address", err);
      } finally {
        setLoadingAddress(false);
      }
    };

    fetchAddress();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddressModeChange = (mode: string) => {
    setAddressMode(mode as "saved" | "custom");
    if (mode === "saved" && savedAddress) {
      setFormData({
        address1: savedAddress.address1,
        address2: savedAddress.address2 || "",
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
      });
    } else if (mode === "custom") {
      setFormData({
        address1: "",
        address2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/store/${params.slug}/orders/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingInfo: formData,
          cartItems: items.map((item) => ({
            strainId: item.productId,
            quantity: item.quantity,
            strain: {
              id: item.productId,
              name: item.name,
              retailPrice: item.price,
              imageUrl: item.image,
            },
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit order");
      }

      setOrderResult(data.order);
      clearCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
      console.error("[Checkout] Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = items[0]?.currency || "R";
  const subtotal = getTotalPrice();

  if (!mounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "hsl(var(--tenant-color-primary) / 0.4)" }}
        />
      </div>
    );
  }

  // Order confirmation screen
  if (orderResult) {
    const isLocalOrder = !orderResult.drGreenOrderId || orderResult.drGreenOrderId.startsWith("LOCAL-");
    return (
      <div
        className="min-h-screen pt-36 pb-20"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div className="container mx-auto px-4 max-w-lg">
          <Card
            style={{
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

  // Empty cart
  if (items.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center py-20 px-4"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div className="max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "hsl(var(--tenant-color-primary) / 0.08)" }}
          >
            <ShoppingBag
              className="w-8 h-8"
              style={{ color: "hsl(var(--tenant-color-primary) / 0.4)" }}
            />
          </div>
          <h2
            className="text-xl font-bold mb-2"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
          >
            Your cart is empty
          </h2>
          <p
            className="mb-6 text-sm"
            style={{
              color: "hsl(var(--tenant-color-text))",
              fontFamily: "var(--tenant-font-base, sans-serif)",
            }}
          >
            Add items before checking out.
          </p>
          <Link href={`${basePath}/products`}>
            <Button
              className="text-white"
              style={{
                backgroundColor: "hsl(var(--tenant-color-primary))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              Browse Products
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
          <Link href={`${basePath}/cart`}>
            <Button
              variant="ghost"
              size="sm"
              style={{ color: "hsl(var(--tenant-color-text))" }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Cart
            </Button>
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "hsl(var(--tenant-color-heading))",
              fontFamily: "var(--tenant-font-heading, sans-serif)",
            }}
          >
            Checkout
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Order Summary */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <Card
                className="sticky top-24"
                style={{
                  borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle
                    className="text-base"
                    style={{ fontFamily: "var(--tenant-font-heading, sans-serif)" }}
                  >
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                          {item.name} &times; {item.quantity}
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
                      className="text-lg font-bold"
                      style={{
                        color: "hsl(var(--tenant-color-primary))",
                        fontFamily: "var(--tenant-font-heading, sans-serif)",
                      }}
                    >
                      {currency}
                      {subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
                      border: "1px solid hsl(var(--tenant-color-primary) / 0.12)",
                    }}
                  >
                    <p
                      className="text-xs leading-relaxed"
                      style={{
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      Payment instructions will be sent after your order is placed.
                      Crypto and card options available.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Shipping + Place Order */}
            <div className="lg:col-span-2 order-1 lg:order-2 space-y-4">
              {/* Shipping Address */}
              <Card
                style={{
                  borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin
                      className="w-4 h-4"
                      style={{ color: "hsl(var(--tenant-color-text))" }}
                    />
                    <span
                      style={{ fontFamily: "var(--tenant-font-heading, sans-serif)" }}
                    >
                      Shipping Address
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Address mode toggle */}
                  {!loadingAddress && savedAddress && (
                    <RadioGroup
                      value={addressMode}
                      onValueChange={handleAddressModeChange}
                      className="space-y-3"
                    >
                      <label
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                        style={{
                          borderColor: addressMode === "saved"
                            ? "hsl(var(--tenant-color-primary) / 0.5)"
                            : "hsl(var(--tenant-color-primary) / 0.12)",
                          backgroundColor: addressMode === "saved"
                            ? "hsl(var(--tenant-color-primary) / 0.06)"
                            : "transparent",
                        }}
                      >
                        <RadioGroupItem value="saved" className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: "hsl(var(--tenant-color-heading))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            Use saved address
                          </p>
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            {savedAddress.address1}, {savedAddress.city},{" "}
                            {savedAddress.state} {savedAddress.postalCode}
                          </p>
                        </div>
                      </label>
                      <label
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
                        style={{
                          borderColor: addressMode === "custom"
                            ? "hsl(var(--tenant-color-primary) / 0.5)"
                            : "hsl(var(--tenant-color-primary) / 0.12)",
                          backgroundColor: addressMode === "custom"
                            ? "hsl(var(--tenant-color-primary) / 0.06)"
                            : "transparent",
                        }}
                      >
                        <RadioGroupItem value="custom" className="mt-0.5" />
                        <div>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: "hsl(var(--tenant-color-heading))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            Enter a different address
                          </p>
                        </div>
                      </label>
                    </RadioGroup>
                  )}

                  {/* Address form fields — shown when custom OR no saved address */}
                  {(addressMode === "custom" || !savedAddress) && (
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor="address1"
                          className="text-sm"
                          style={{
                            color: "hsl(var(--tenant-color-text))",
                            fontFamily: "var(--tenant-font-base, sans-serif)",
                          }}
                        >
                          Address Line 1 *
                        </Label>
                        <Input
                          id="address1"
                          name="address1"
                          value={formData.address1}
                          onChange={handleChange}
                          required
                          placeholder="Street address"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor="address2"
                          className="text-sm"
                          style={{
                            color: "hsl(var(--tenant-color-text))",
                            fontFamily: "var(--tenant-font-base, sans-serif)",
                          }}
                        >
                          Address Line 2
                        </Label>
                        <Input
                          id="address2"
                          name="address2"
                          value={formData.address2}
                          onChange={handleChange}
                          placeholder="Apartment, suite, etc."
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label
                            htmlFor="city"
                            className="text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            City *
                          </Label>
                          <Input
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="state"
                            className="text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            State / Province *
                          </Label>
                          <Input
                            id="state"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            required
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label
                            htmlFor="postalCode"
                            className="text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            Postal Code *
                          </Label>
                          <Input
                            id="postalCode"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label
                            htmlFor="country"
                            className="text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily: "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            Country *
                          </Label>
                          <Input
                            id="country"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            required
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Place Order */}
              <Card
                style={{
                  borderColor: "hsl(var(--tenant-color-primary) / 0.12)",
                }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard
                      className="w-4 h-4"
                      style={{ color: "hsl(var(--tenant-color-text))" }}
                    />
                    <span
                      style={{ fontFamily: "var(--tenant-font-heading, sans-serif)" }}
                    >
                      Payment
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Shipping summary when using saved */}
                  {addressMode === "saved" && savedAddress && (
                    <div
                      className="rounded-lg p-3 text-sm"
                      style={{
                        backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      <p
                        className="font-medium mb-1"
                        style={{ color: "hsl(var(--tenant-color-heading))" }}
                      >
                        Shipping to:
                      </p>
                      <p>
                        {savedAddress.address1}
                        {savedAddress.address2 ? `, ${savedAddress.address2}` : ""}
                      </p>
                      <p>
                        {savedAddress.city}, {savedAddress.state}{" "}
                        {savedAddress.postalCode}
                      </p>
                      <p>{savedAddress.country}</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 text-sm font-semibold text-white"
                    disabled={isSubmitting}
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Place Order — {currency}
                        {subtotal.toFixed(2)}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
