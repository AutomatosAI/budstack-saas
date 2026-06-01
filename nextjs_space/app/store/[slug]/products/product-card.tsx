"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Leaf, ShoppingCart, Lock, Loader2 } from "lucide-react";
import { WEIGHT_OPTIONS } from "@/lib/cart-store";
import { toast } from "@/components/ui/sonner";
import { KycStatus } from "@/app/actions/kyc-check";
import { parseToArray } from "./products-helpers";

export function ProductCard({
  product,
  basePath,
  kycStatus,
  addItem,
}: {
  product: any;
  basePath: string;
  kycStatus: KycStatus | null;
  addItem: any;
}) {
  const [selectedWeight, setSelectedWeight] = useState<number>(2);
  const feelings = parseToArray(product.feelings);
  const flavours = parseToArray(product.flavour);
  const imageUrl = product.image_url || product.imageUrl;
  const pricePerGram = product.price || product.retailPrice || 0;
  const currency = product.currency || "R";
  const isAvailable = product.isAvailable !== false && product.in_stock !== false;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) return;

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: pricePerGram,
      quantity: selectedWeight,
      image: imageUrl,
      thcContent: product.thc_content || product.thc || 0,
      cbdContent: product.cbd_content || product.cbd || 0,
      currency,
    });
    toast.success(`Added ${product.name} (${selectedWeight}g) to cart`);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`${basePath}/products/${product.id}`}>
        <div
          className="group rounded-2xl overflow-hidden border hover:shadow-xl transition-all duration-300"
          style={{
            backgroundColor: "hsl(var(--tenant-color-background))",
            borderColor: "hsl(var(--tenant-color-primary) / 0.1)",
          }}
        >
          {/* Image */}
          <div
            className="relative aspect-square overflow-hidden"
            style={{
              backgroundColor: "hsl(var(--tenant-color-primary) / 0.04)",
            }}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Leaf
                  className="h-20 w-20 opacity-10"
                  style={{ color: "hsl(var(--tenant-color-primary))" }}
                />
              </div>
            )}

            {/* Out of stock overlay */}
            {!isAvailable && (
              <div
                className="absolute bottom-0 left-0 right-0 py-3 text-center text-sm font-bold tracking-wide text-white uppercase"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary) / 0.85)",
                }}
              >
                Out of Stock
              </div>
            )}
          </div>

          {/* Card body */}
          <div className="p-5 space-y-3">
            {/* Name + Price row */}
            <div className="flex items-start justify-between gap-2">
              <h3
                className="text-base font-semibold leading-tight line-clamp-2"
                style={{
                  color: "hsl(var(--tenant-color-heading))",
                  fontFamily: "var(--tenant-font-heading, sans-serif)",
                }}
              >
                {product.name}
              </h3>
              <div className="text-right flex-shrink-0">
                <p
                  className="text-lg font-bold whitespace-nowrap"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  {currency} {pricePerGram.toFixed(2)}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wider"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  per gram
                </p>
              </div>
            </div>

            {/* Effect tags */}
            {feelings.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {feelings.slice(0, 3).map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium"
                    style={{
                      borderColor: "hsl(var(--tenant-color-primary) / 0.25)",
                      color: "hsl(var(--tenant-color-primary))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {f}
                  </span>
                ))}
                {feelings.length > 3 && (
                  <span
                    className="inline-flex items-center text-xs px-2 py-1 rounded-full"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    +{feelings.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Flavour tags */}
            {flavours.length > 0 && (
              <div>
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold mb-1 block"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  Flavour
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {flavours.slice(0, 4).map((fl) => (
                    <span
                      key={fl}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
                        color: "hsl(var(--tenant-color-text))",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {fl}
                    </span>
                  ))}
                  {flavours.length > 4 && (
                    <span
                      className="text-xs px-1"
                      style={{ color: "hsl(var(--tenant-color-text))" }}
                    >
                      +{flavours.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* THC / CBD */}
            <div className="flex items-center gap-3">
              {(product.thc_content || product.thc) ? (
                <span
                  className="text-xs font-medium flex items-center gap-1"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle
                      cx="6"
                      cy="6"
                      r="5"
                      stroke="hsl(var(--tenant-color-primary))"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                  {(product.thc_content || product.thc || 0).toFixed(1)}%{" "}
                  <span style={{ color: "hsl(var(--tenant-color-text) / 0.5)" }}>
                    THC
                  </span>
                </span>
              ) : null}
              {(product.cbd_content || product.cbd) ? (
                <span
                  className="text-xs font-medium flex items-center gap-1"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle
                      cx="6"
                      cy="6"
                      r="5"
                      stroke="hsl(var(--tenant-color-primary) / 0.5)"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                  {(product.cbd_content || product.cbd || 0).toFixed(1)}%{" "}
                  <span style={{ color: "hsl(var(--tenant-color-text) / 0.5)" }}>
                    CBD
                  </span>
                </span>
              ) : null}
            </div>

            {/* Weight selector */}
            <div
              className="flex gap-1"
              onClick={(e) => e.preventDefault()}
            >
              {WEIGHT_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedWeight(w);
                  }}
                  className="flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150"
                  style={{
                    backgroundColor:
                      selectedWeight === w
                        ? "hsl(var(--tenant-color-primary))"
                        : "hsl(var(--tenant-color-primary) / 0.06)",
                    color:
                      selectedWeight === w
                        ? "white"
                        : "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {w}g
                </button>
              ))}
            </div>

            {/* CTA button */}
            {kycStatus === null ? (
              <div
                className="h-11 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary) / 0.06)",
                }}
              >
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: "hsl(var(--tenant-color-primary))" }}
                />
              </div>
            ) : !kycStatus.isLoggedIn ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `${basePath}/register`;
                }}
                className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-md text-white"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                <Lock className="w-4 h-4" />
                Register to Buy
              </button>
            ) : !isAvailable ? (
              <button
                disabled
                className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary) / 0.15)",
                  color: "hsl(var(--tenant-color-text))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                <ShoppingCart className="w-4 h-4" />
                Out of Stock
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-md text-white"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-primary))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart — {currency} {(pricePerGram * selectedWeight).toFixed(2)}
              </button>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
