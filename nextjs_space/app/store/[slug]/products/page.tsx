"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ShieldCheck,
  Truck,
  HeartPulse,
  Search,
  ShoppingCart,
  Lock,
  Loader2,
  Settings,
} from "lucide-react";
import { Tenant } from "@/types/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RestrictedRegionGate } from "@/components/shop/RestrictedRegionGate";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartStore, WEIGHT_OPTIONS } from "@/lib/cart-store";
import { toast } from "@/components/ui/sonner";
import { checkUserKycStatus, KycStatus } from "@/app/actions/kyc-check";
import { getTenantBasePath } from "@/lib/tenant-utils";

// --------------- helpers ---------------

const parseToArray = (str?: string): string[] => {
  if (!str) return [];
  return str
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};

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
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// --------------- skeleton ---------------

function ProductSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ borderColor: "hsl(var(--tenant-color-primary) / 0.1)" }}
    >
      <Skeleton className="aspect-square w-full" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-14 rounded-lg" />
          <Skeleton className="h-9 w-14 rounded-lg" />
          <Skeleton className="h-9 w-14 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}

// --------------- product card ---------------

function ProductCard({
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

// --------------- page ---------------

export default function ProductsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const basePath = getTenantBasePath(slug);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [missingCredentials, setMissingCredentials] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedFlavours, setSelectedFlavours] = useState<string[]>([]);

  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    checkUserKycStatus().then(setKycStatus);
  }, []);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/store/${slug}/products`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tenant) {
          setTenant({ ...data.tenant, countryCode: data.country } as Tenant);
        }
        if (data.success) {
          setProducts(data.data);
        } else if (data.missingCredentials) {
          setMissingCredentials(true);
        } else {
          setProductsError(data.error || "Failed to load products");
          if (data.error === "Tenant not found") setTenant(null);
        }
        setLoading(false);
        setProductsLoading(false);
      })
      .catch(() => {
        setProductsError("Failed to load products. Please try again later.");
        setLoading(false);
        setProductsLoading(false);
      });
  }, [slug]);

  // ---------- derived filter options ----------

  const allEffects = Array.from(
    new Set(products.flatMap((p) => parseToArray(p.feelings)))
  ).sort();

  const allFlavours = Array.from(
    new Set(products.flatMap((p) => parseToArray(p.flavour)))
  ).sort();

  // ---------- filtered products ----------

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const productEffects = parseToArray(product.feelings);
    const matchesEffects =
      selectedEffects.length === 0 ||
      selectedEffects.some((e) => productEffects.includes(e));

    const productFlavours = parseToArray(product.flavour);
    const matchesFlavours =
      selectedFlavours.length === 0 ||
      selectedFlavours.some((f) => productFlavours.includes(f));

    return matchesSearch && matchesEffects && matchesFlavours;
  });

  // ---------- toggle helpers ----------

  const toggleEffect = (effect: string) => {
    setSelectedEffects((prev) =>
      prev.includes(effect)
        ? prev.filter((e) => e !== effect)
        : [...prev, effect]
    );
  };

  const toggleFlavour = (flavour: string) => {
    setSelectedFlavours((prev) =>
      prev.includes(flavour)
        ? prev.filter((f) => f !== flavour)
        : [...prev, flavour]
    );
  };

  // ---------- loading state ----------

  if (loading) {
    return (
      <div
        className="min-h-screen pb-24 lg:pb-0"
        style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
      >
        <div>
          <section className="pt-28 md:pt-32 pb-12 md:pb-16">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <Skeleton className="h-12 w-80 mx-auto" />
                <Skeleton className="h-6 w-96 mx-auto" />
              </div>
            </div>
          </section>
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
  const heroSubtitle =
    pageContent?.heroSubtitle ||
    "Browse our selection of pharmaceutical-grade medical cannabis products, carefully curated for qualified patients.";

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      {/* Hero */}
      <section
        className="relative pt-28 sm:pt-32 pb-12 sm:pb-16"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--tenant-color-primary) / 0.08), transparent)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-3xl mx-auto text-center"
          >
            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroTitle}
            </motion.h1>
            <motion.p
              className="text-base sm:text-lg px-2"
              style={{
                color: "hsl(var(--tenant-color-text))",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
              variants={fadeInUp}
            >
              {heroSubtitle}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Trust badges */}
      <section
        className="py-6 sm:py-8 border-y"
        style={{
          backgroundColor: "hsl(var(--tenant-color-primary) / 0.03)",
          borderColor: "hsl(var(--tenant-color-primary) / 0.1)",
        }}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <b.icon
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
                    {b.title}
                  </p>
                  <p
                    className="text-xs line-clamp-1 hidden sm:block"
                    style={{
                      color: "hsl(var(--tenant-color-text))",
                      fontFamily: "var(--tenant-font-base, sans-serif)",
                    }}
                  >
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Effect filter */}
          {allEffects.length > 0 && (
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                style={{
                  color: "hsl(var(--tenant-color-text) / 0.5)",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Filter by Effect
              </div>
              <div className="flex flex-wrap gap-2">
                {allEffects.map((effect) => {
                  const active = selectedEffects.includes(effect);
                  return (
                    <button
                      key={effect}
                      onClick={() => toggleEffect(effect)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150"
                      style={{
                        backgroundColor: active
                          ? "hsl(var(--tenant-color-primary))"
                          : "transparent",
                        color: active
                          ? "white"
                          : "hsl(var(--tenant-color-text))",
                        borderColor: active
                          ? "hsl(var(--tenant-color-primary))"
                          : "hsl(var(--tenant-color-primary) / 0.2)",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {effect}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terpene / Flavour filter */}
          {allFlavours.length > 0 && (
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-widest mb-3"
                style={{
                  color: "hsl(var(--tenant-color-text) / 0.5)",
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Filter by Terpene
              </div>
              <div className="flex flex-wrap gap-2">
                {allFlavours.map((flavour) => {
                  const active = selectedFlavours.includes(flavour);
                  return (
                    <button
                      key={flavour}
                      onClick={() => toggleFlavour(flavour)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150"
                      style={{
                        backgroundColor: active
                          ? "hsl(var(--tenant-color-primary))"
                          : "transparent",
                        color: active
                          ? "white"
                          : "hsl(var(--tenant-color-text))",
                        borderColor: active
                          ? "hsl(var(--tenant-color-primary))"
                          : "hsl(var(--tenant-color-primary) / 0.2)",
                        fontFamily: "var(--tenant-font-base, sans-serif)",
                      }}
                    >
                      {flavour}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search + count */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{
                  color: "hsl(var(--tenant-color-text))",
                  opacity: 0.4,
                }}
              />
              <input
                type="text"
                placeholder="Search strains..."
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
            <p
              className="text-sm whitespace-nowrap"
              style={{
                color: "hsl(var(--tenant-color-text) / 0.6)",
                fontFamily: "var(--tenant-font-base, sans-serif)",
              }}
            >
              Showing {filteredProducts.length} of {products.length} strains
            </p>
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="py-4 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <RestrictedRegionGate countryCode={tenant?.countryCode || ""}>
            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : missingCredentials ? (
              <div className="text-center py-20 max-w-lg mx-auto">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{
                    backgroundColor: "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <Settings
                    className="h-8 w-8"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
                <h3
                  className="text-xl font-semibold mb-3"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  Products Coming Soon
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  This store is still being set up. The store admin needs to add
                  their Dr Green API keys in the{" "}
                  <span className="font-medium">Tenant Admin Dashboard</span>{" "}
                  under{" "}
                  <span className="font-medium">Settings</span>{" "}
                  to connect their product catalog.
                </p>
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
                  No strains match your filters
                </p>
                <p
                  className="text-sm mb-4"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  Try adjusting your search or clearing some filters.
                </p>
                {(selectedEffects.length > 0 || selectedFlavours.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedEffects([]);
                      setSelectedFlavours([]);
                      setSearchQuery("");
                    }}
                    className="text-sm font-medium underline"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  >
                    Clear all filters
                  </button>
                )}
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
                    <ProductCard
                      key={product.id}
                      product={product}
                      basePath={basePath}
                      kycStatus={kycStatus}
                      addItem={addItem}
                    />
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
