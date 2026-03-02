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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Order confirmation screen
  if (orderResult) {
    const isPending = !orderResult.drGreenOrderId;
    return (
      <div className="min-h-screen bg-gray-50 pt-36 pb-20">
        <div className="container mx-auto px-4 max-w-lg">
          <Card className="border-gray-200">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              {isPending ? (
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isPending ? "Order Received" : "Order Confirmed"}
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                  {isPending
                    ? "Our team will process your order shortly."
                    : "Your order has been placed successfully."}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order ID</span>
                  <span className="font-mono font-medium text-gray-900">
                    {orderResult.orderNumber}
                  </span>
                </div>
                {orderResult.total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium text-gray-900">
                      {currency}
                      {orderResult.total.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                {isPending
                  ? "You'll receive a confirmation email once processed."
                  : "Tracking information will be sent to your email."}
              </p>

              <div className="pt-2 space-y-2">
                <Link href={`${basePath}/products`} className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6 text-sm">Add items before checking out.</p>
          <Link href={`${basePath}/products`}>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              Browse Products
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-36 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href={`${basePath}/cart`}>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Cart
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Order Summary */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <Card className="border-gray-200 sticky top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.productId} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate pr-2">
                          {item.name} &times; {item.quantity}
                        </span>
                        <span className="font-medium text-gray-900 whitespace-nowrap">
                          {currency}
                          {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-green-600">
                      {currency}
                      {subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                    <p className="text-xs text-green-700 leading-relaxed">
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
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    Shipping Address
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
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          addressMode === "saved"
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <RadioGroupItem value="saved" className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            Use saved address
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {savedAddress.address1}, {savedAddress.city},{" "}
                            {savedAddress.state} {savedAddress.postalCode}
                          </p>
                        </div>
                      </label>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          addressMode === "custom"
                            ? "border-green-300 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <RadioGroupItem value="custom" className="mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
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
                        <Label htmlFor="address1" className="text-sm text-gray-700">
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
                        <Label htmlFor="address2" className="text-sm text-gray-700">
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
                          <Label htmlFor="city" className="text-sm text-gray-700">
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
                          <Label htmlFor="state" className="text-sm text-gray-700">
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
                          <Label htmlFor="postalCode" className="text-sm text-gray-700">
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
                          <Label htmlFor="country" className="text-sm text-gray-700">
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
              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Shipping summary when using saved */}
                  {addressMode === "saved" && savedAddress && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                      <p className="font-medium text-gray-700 mb-1">Shipping to:</p>
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
                    className="w-full h-12 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white"
                    disabled={isSubmitting}
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
