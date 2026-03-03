"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ShieldCheck,
  Truck,
  HeartPulse,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Tenant } from "@/types/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import { RestrictedRegionGate } from "@/components/shop/RestrictedRegionGate";
import { Skeleton } from "@/components/ui/skeleton";

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

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

function ProductSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: "hsl(var(--tenant-color-primary) / 0.1)" }}>
      <Skeleton className="aspect-square w-full" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => {
    if (slug) {
      fetch(`/api/store/${slug}/products`)
        .then((res) => res.json())
        .then((data) => {
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

  // Extract unique strain types for filter
  const strainTypes = Array.from(
    new Set(
      products
        .map((p) => p.strain_type)
        .filter(Boolean)
    )
  ).sort();

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "all" || product.strain_type === selectedType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div
        className="min-h-screen pb-24 lg:pb-0"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div className="pt-28 md:pt-32">
          {/* Skeleton hero */}
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <Skeleton className="h-12 w-80 mx-auto" />
                <Skeleton className="h-6 w-96 mx-auto" />
              </div>
            </div>
          </section>
          {/* Skeleton grid */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!tenant) {
    notFound();
  }

  const pageContent = (tenant as any).pageContent?.products;
  const heroTitle = pageContent?.heroTitle || "Premium Cultivars";
  const heroSubtitle = pageContent?.heroSubtitle || "Browse our selection of pharmaceutical-grade medical cannabis products, carefully curated for qualified patients.";
  const heroImage = pageContent?.heroImage || null;

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      {/* Hero Section */}
      <section
        className="relative pt-28 sm:pt-32 pb-12 sm:pb-16 overflow-hidden"
        style={{
          background: heroImage
            ? undefined
            : "linear-gradient(to bottom, hsl(var(--tenant-color-primary) / 0.08), transparent)",
        }}
      >
        {heroImage && (
          <>
            <Image
              src={heroImage}
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to bottom, hsl(var(--tenant-color-primary) / 0.85), hsl(var(--tenant-color-primary) / 0.6))",
              }}
            />
          </>
        )}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
              style={{
                color: heroImage ? "white" : "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroTitle}
            </motion.h1>
            <motion.p
              className="text-base sm:text-lg mb-8 px-2"
              style={{
                color: heroImage ? "rgba(255,255,255,0.9)" : "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroSubtitle}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Trust Badges */}
      <section
        className="py-6 sm:py-8 border-y"
        style={{
          backgroundColor: "hsl(var(--tenant-color-primary) / 0.03)",
          borderColor: "hsl(var(--tenant-color-primary) / 0.1)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {benefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                className="flex items-center gap-3"
                variants={fadeInUp}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <benefit.icon
                    className="h-5 w-5"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="font-medium text-sm"
                    style={{
                      color: "hsl(var(--tenant-color-heading))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {benefit.title}
                  </p>
                  <p
                    className="text-xs line-clamp-1 hidden sm:block"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 max-w-3xl mx-auto">
            {/* Search */}
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{
                  color: "hsl(var(--tenant-color-text))",
                  opacity: 0.5,
                }}
              />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all"
                style={{
                  backgroundColor: "hsl(var(--tenant-color-background))",
                  borderColor: "hsl(var(--tenant-color-primary) / 0.2)",
                  color: "hsl(var(--tenant-color-text))",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              />
            </div>

            {/* Type filter */}
            {strainTypes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal
                  className="w-4 h-4 hidden sm:block"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    opacity: 0.5,
                  }}
                />
                <button
                  onClick={() => setSelectedType("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedType === "all" ? "shadow-sm" : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor:
                      selectedType === "all"
                        ? "hsl(var(--tenant-color-primary))"
                        : "hsl(var(--tenant-color-primary) / 0.08)",
                    color:
                      selectedType === "all"
                        ? "white"
                        : "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  All
                </button>
                {strainTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                      selectedType === type ? "shadow-sm" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor:
                        selectedType === type
                          ? "hsl(var(--tenant-color-primary))"
                          : "hsl(var(--tenant-color-primary) / 0.08)",
                      color:
                        selectedType === type
                          ? "white"
                          : "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <RestrictedRegionGate countryCode={tenant?.countryCode || ""}>
            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : productsError ? (
              <Alert className="max-w-2xl mx-auto">
                <AlertDescription>{productsError}</AlertDescription>
              </Alert>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <Search
                  className="h-16 w-16 mx-auto mb-4 opacity-20"
                  style={{ color: "hsl(var(--tenant-color-text))" }}
                />
                <p
                  className="text-lg mb-2"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  {searchQuery || selectedType !== "all"
                    ? "No products match your filters"
                    : "No products available"}
                </p>
                <p
                  className="text-sm"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  {searchQuery || selectedType !== "all"
                    ? "Try adjusting your search or filters."
                    : "Check back soon for new products."}
                </p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
              >
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      className="group"
                    >
                      <Link href={`products/${product.id}`}>
                        <div
                          className="rounded-xl overflow-hidden border hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                          style={{
                            backgroundColor:
                              "hsl(var(--tenant-color-background))",
                            borderColor:
                              "hsl(var(--tenant-color-primary) / 0.1)",
                          }}
                        >
                          {/* Product Image */}
                          <div
                            className="relative aspect-square overflow-hidden"
                            style={{
                              backgroundColor:
                                "hsl(var(--tenant-color-primary) / 0.03)",
                            }}
                          >
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Leaf
                                  className="h-16 w-16 opacity-15"
                                  style={{
                                    color:
                                      "hsl(var(--tenant-color-primary))",
                                  }}
                                />
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background:
                                  "linear-gradient(to top, hsl(var(--tenant-color-primary) / 0.2), transparent 50%)",
                              }}
                            />
                          </div>

                          {/* Product Info */}
                          <div className="p-5">
                            <h3
                              className="text-base font-semibold mb-1 group-hover:opacity-80 transition-opacity line-clamp-2"
                              style={{
                                color: "hsl(var(--tenant-color-heading))",
                                fontFamily:
                                  "var(--tenant-font-heading, sans-serif)",
                              }}
                            >
                              {product.name}
                            </h3>

                            {product.strain_type && (
                              <p
                                className="text-xs mb-3 capitalize"
                                style={{
                                  color: "hsl(var(--tenant-color-primary))",
                                  fontFamily:
                                    "var(--tenant-font-base, sans-serif)",
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
                                    className="text-xs px-2 py-1 rounded-md font-medium"
                                    style={{
                                      backgroundColor:
                                        "hsl(var(--tenant-color-primary) / 0.1)",
                                      color:
                                        "hsl(var(--tenant-color-primary))",
                                      fontFamily:
                                        "var(--tenant-font-base, sans-serif)",
                                    }}
                                  >
                                    THC: {product.thc_content}%
                                  </span>
                                )}
                                {product.cbd_content && (
                                  <span
                                    className="text-xs px-2 py-1 rounded-md font-medium"
                                    style={{
                                      backgroundColor:
                                        "hsl(var(--tenant-color-primary) / 0.1)",
                                      color:
                                        "hsl(var(--tenant-color-primary))",
                                      fontFamily:
                                        "var(--tenant-font-base, sans-serif)",
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
                                className="text-xl font-bold mb-4"
                                style={{
                                  color: "hsl(var(--tenant-color-heading))",
                                  fontFamily:
                                    "var(--tenant-font-heading, sans-serif)",
                                }}
                              >
                                {product.currency || "€"}{" "}
                                {product.price.toFixed(2)}
                              </p>
                            )}

                            {/* View Details Button */}
                            <button
                              className="w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 hover:shadow-md"
                              style={{
                                backgroundColor:
                                  "hsl(var(--tenant-color-primary))",
                                color: "white",
                                fontFamily:
                                  "var(--tenant-font-base, sans-serif)",
                              }}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </RestrictedRegionGate>
        </div>
      </section>
    </div>
  );
}
