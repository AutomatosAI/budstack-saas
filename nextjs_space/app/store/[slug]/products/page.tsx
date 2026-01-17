"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Leaf, ShieldCheck, Truck, HeartPulse, Search } from "lucide-react";
import { Tenant } from "@/types/client";
// import { fetchProducts } from '@/lib/doctor-green-api'; // Direct import removed for security
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { RestrictedRegionGate } from "@/components/shop/RestrictedRegionGate";

const benefits = [
  {
    icon: ShieldCheck,
    title: "Medical Grade",
    description: "All products are pharmaceutical-grade quality",
  },
  {
    icon: Leaf,
    title: "Lab Tested",
    description: "Third-party tested for purity and potency",
  },
  {
    icon: Truck,
    title: "Discreet Delivery",
    description: "Secure and confidential shipping",
  },
  {
    icon: HeartPulse,
    title: "Patient Support",
    description: "Dedicated medical support team",
  },
];

export default function ProductsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      // Fetch products and tenant info from the slug-based API
      fetch(`/api/store/${slug}/products`)
        .then((res) => res.json())
        .then((data) => {
          // Always try to set tenant if available, even on error
          if (data.tenant) {
            setTenant({
              ...data.tenant,
              countryCode: data.country,
            } as Tenant);
          }

          if (data.success) {
            setProducts(data.data);
          } else {
            console.error("API Error:", data.error);
            setProductsError(data.error || "Failed to load products");
            // Only trigger 404 if it's explicitly "Tenant not found"
            if (data.error === "Tenant not found") {
              setTenant(null);
            }
          }
          setLoading(false);
          setProductsLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching products:", err);
          setProductsError("Failed to load products. Please try again later.");
          setLoading(false);
          setProductsLoading(false);
        });
    }
  }, [slug]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--tenant-color-background)" }}
      >
        <p className="text-lg" style={{ color: "var(--tenant-color-text)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!tenant) {
    notFound();
  }

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "var(--tenant-color-background)" }}
    >
      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-8 sm:pb-12 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.05), transparent)",
          }}
        />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4"
              style={{
                color: "var(--tenant-color-heading)",
                fontFamily: "var(--tenant-font-heading)",
              }}
            >
              Premium Cultivars
            </h1>
            <p
              className="text-base sm:text-lg mb-6 sm:mb-8 px-2"
              style={{
                color: "var(--tenant-color-text)",
                fontFamily: "var(--tenant-font-base)",
              }}
            >
              Browse our selection of pharmaceutical-grade medical cannabis
              products, carefully curated for qualified patients.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section
        className="py-6 sm:py-8 border-y"
        style={{
          backgroundColor: "var(--tenant-color-surface, rgba(0,0,0,0.02))",
          borderColor: "var(--tenant-color-border, rgba(0,0,0,0.1))",
        }}
      >
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start sm:items-center gap-2 sm:gap-3"
              >
                <div
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)",
                  }}
                >
                  <benefit.icon
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    style={{ color: "var(--tenant-color-primary)" }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="font-medium text-xs sm:text-sm"
                    style={{
                      color: "var(--tenant-color-heading)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    {benefit.title}
                  </p>
                  <p
                    className="text-[10px] sm:text-xs line-clamp-2"
                    style={{
                      color: "var(--tenant-color-text)",
                      fontFamily: "var(--tenant-font-base)",
                    }}
                  >
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <RestrictedRegionGate countryCode={tenant?.countryCode || ""}>
            {productsLoading ? (
              <div className="flex justify-center items-center py-20">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2"
                  style={{ borderColor: "var(--tenant-color-primary)" }}
                ></div>
              </div>
            ) : productsError ? (
              <Alert className="max-w-2xl mx-auto">
                <AlertDescription>{productsError}</AlertDescription>
              </Alert>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Search
                  className="h-16 w-16 mx-auto mb-4 opacity-30"
                  style={{ color: "var(--tenant-color-text)" }}
                />
                <p
                  className="text-lg"
                  style={{
                    color: "var(--tenant-color-text)",
                    fontFamily: "var(--tenant-font-base)",
                  }}
                >
                  No products available for your region at this time.
                </p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <Link href={`products/${product.id}`}>
                      <div
                        className="rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300"
                        style={{
                          backgroundColor: "var(--tenant-color-surface, white)",
                          borderColor:
                            "var(--tenant-color-border, rgba(0,0,0,0.1))",
                        }}
                      >
                        {/* Product Image */}
                        <div className="relative aspect-square bg-gray-100 overflow-hidden">
                          {product.image_url ? (
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{
                                backgroundColor:
                                  "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.05)",
                              }}
                            >
                              <Leaf
                                className="h-16 w-16 opacity-20"
                                style={{ color: "var(--tenant-color-primary)" }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-4">
                          <h3
                            className="text-lg font-semibold mb-2 group-hover:text-opacity-80 transition-colors line-clamp-2"
                            style={{
                              color: "var(--tenant-color-heading)",
                              fontFamily: "var(--tenant-font-heading)",
                            }}
                          >
                            {product.name}
                          </h3>

                          {product.strain_type && (
                            <p
                              className="text-sm mb-3 capitalize"
                              style={{
                                color: "var(--tenant-color-text)",
                                fontFamily: "var(--tenant-font-base)",
                              }}
                            >
                              {product.strain_type}
                            </p>
                          )}

                          {/* THC/CBD Content */}
                          {(product.thc_content || product.cbd_content) && (
                            <div className="flex gap-2 mb-3">
                              {product.thc_content && (
                                <span
                                  className="text-xs px-2 py-1 rounded"
                                  style={{
                                    backgroundColor:
                                      "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)",
                                    color: "var(--tenant-color-primary)",
                                    fontFamily: "var(--tenant-font-base)",
                                  }}
                                >
                                  THC: {product.thc_content}%
                                </span>
                              )}
                              {product.cbd_content && (
                                <span
                                  className="text-xs px-2 py-1 rounded"
                                  style={{
                                    backgroundColor:
                                      "rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)",
                                    color: "var(--tenant-color-primary)",
                                    fontFamily: "var(--tenant-font-base)",
                                  }}
                                >
                                  CBD: {product.cbd_content}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Price */}
                          {product.price && (
                            <p
                              className="text-xl font-bold"
                              style={{
                                color: "var(--tenant-color-heading)",
                                fontFamily: "var(--tenant-font-heading)",
                              }}
                            >
                              {product.currency || '€'} {product.price.toFixed(2)}
                            </p>
                          )}

                          {/* View Details Button */}
                          <button
                            className="mt-4 w-full px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200"
                            style={{
                              backgroundColor: "var(--tenant-color-primary)",
                              color: "white",
                              fontFamily: "var(--tenant-font-base)",
                            }}
                          >
                            <span style={{ color: "white" }}>View Details</span>
                          </button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </RestrictedRegionGate>
        </div>
      </section >
    </div >
  );
}
