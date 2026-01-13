"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/lib/cart-store";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { items, updateQuantity, removeItem, getTotalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const subtotal = getTotalPrice();
  const cartTotal = subtotal; // Add tax/shipping logic here if needed later

  // Placeholder for eligibility check - can be expanded with real tenant auth data later
  const isEligible = true;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-8">
            Looks like you haven't added any medicine to your cart yet.
          </p>
          <Link href={`/store/${slug}`}>
            <Button className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 font-serif">
            Your Cart
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <div className="p-4 sm:p-6 flex gap-4 sm:gap-6">
                    {/* Image */}
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain p-2"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBag className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-500 font-medium">
                            €{item.price.toFixed(2)} / unit
                          </p>
                          {/* Add THC/CBD badges here if available in item data */}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors -mr-2 -mt-2"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        {/* Quantity Controls */}
                        <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                Math.max(0, item.quantity - 1),
                              )
                            }
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-10 text-center text-sm font-medium text-gray-900">
                            {item.quantity}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm"
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">
                            €{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 bg-white/80 backdrop-blur-xl border-gray-200 shadow-lg">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({items.length} items)</span>
                    <span className="font-medium text-gray-900">
                      €{subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">
                      Calculated at checkout
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-end">
                  <span className="text-base font-semibold text-gray-900">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    €{cartTotal.toFixed(2)}
                  </span>
                </div>

                {/* Checkout Button */}
                <div className="space-y-3 pt-2">
                  <Button
                    className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                    size="lg"
                    onClick={() => router.push(`/store/${slug}/checkout`)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceed to Checkout
                  </Button>

                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex gap-3 items-start">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Secure checkout powered by Dr. Green. Your medical
                      eligibility will be verified in the next step.
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
