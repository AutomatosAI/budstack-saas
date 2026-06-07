"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getStrainIcon, getStrainColor } from "./product-detail-helpers";
import type { Product } from "./product-detail-types";

export function ProductSimilarSection({
  similarProducts,
  basePath,
  productType,
  displayCurrency,
}: {
  similarProducts: Product[];
  basePath: string;
  productType: string;
  displayCurrency: string;
}) {
  if (similarProducts.length === 0) return null;
  return (
          <div
            className="border-t pt-16"
            style={{ borderColor: "hsl(var(--tenant-color-border))" }}
          >
            <h2
              className="text-3xl font-bold mb-8"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Similar {productType} Products
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarProducts.map((similarProduct) => {
                const simImageUrl =
                  similarProduct.image_url || similarProduct.imageUrl;
                const simColors = getStrainColor(similarProduct.type);

                return (
                  <Link
                    key={similarProduct.id}
                    href={`${basePath}/products/${similarProduct.id}`}
                    className="group"
                  >
                    <div
                      className="rounded-xl overflow-hidden transition-all duration-300 hover:scale-105"
                      style={{
                        boxShadow:
                          "var(--tenant-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
                        backgroundColor: "hsl(var(--tenant-color-surface))",
                      }}
                    >
                      <div
                        className={`relative bg-gradient-to-br ${simColors.bg}`}
                        style={{ paddingBottom: "100%" }}
                      >
                        {simImageUrl ? (
                          <div className="absolute inset-0">
                            <Image
                              src={simImageUrl}
                              alt={similarProduct.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            />
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {getStrainIcon(similarProduct.type)}
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <Badge className={`${simColors.badge} mb-2 text-xs`}>
                          {similarProduct.type}
                        </Badge>
                        <h3
                          className="font-semibold mb-2 line-clamp-2 group-hover:underline"
                          style={{
                            color: "hsl(var(--tenant-color-heading))",
                          }}
                        >
                          {similarProduct.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span
                            style={{
                              color: "hsl(var(--tenant-color-primary))",
                            }}
                          >
                            THC: {(similarProduct.thc || 0).toFixed(1)}%
                          </span>
                          <span
                            style={{
                              color: "hsl(var(--tenant-color-text-muted))",
                            }}
                          >
                            •
                          </span>
                          <span
                            style={{
                              color: "hsl(var(--tenant-color-secondary))",
                            }}
                          >
                            CBD: {(similarProduct.cbd || 0).toFixed(1)}%
                          </span>
                        </div>
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: "hsl(var(--tenant-color-heading))",
                          }}
                        >
                          {similarProduct.currency || displayCurrency}{" "}
                          {(
                            similarProduct.price ||
                            similarProduct.retailPrice ||
                            0
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
  );
}
