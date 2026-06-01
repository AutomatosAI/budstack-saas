"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Check,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { toast } from "@/components/ui/sonner";
import { useCartStore } from "@/lib/cart-store";
import { checkUserKycStatus, KycStatus } from "@/app/actions/kyc-check";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { getStrainIcon, getStrainColor } from "./product-detail-helpers";
import { ProductSimilarSection } from "./product-similar-section";
import type { Product, ApiResponse } from "./product-detail-types";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const basePath = getTenantBasePath(slug);
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeight, setSelectedWeight] = useState(2);
  const [selectedImage, setSelectedImage] = useState(0);

  const addItem = useCartStore((state) => state.addItem);
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);

  useEffect(() => {
    checkUserKycStatus().then(setKycStatus);
  }, []);

  useEffect(() => {
    if (slug && productId) {
      fetchProduct();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/store/${slug}/products?id=${productId}`);
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Failed to fetch product ${productId}: ${res.status} ${res.statusText} ${errBody}`);
      }
      const responseData: ApiResponse = await res.json();

      if (!responseData.success || !responseData.data) {
        throw new Error(responseData.error || "Failed to fetch product");
      }

      setProduct(responseData.data);
      setSimilarProducts(responseData.similarProducts || []);
    } catch (err) {
      console.error("Error fetching product:", err);
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    try {
      if (!product) return;

      addItem({
        id: product.id,
        productId: product.id,
        name: product.name,
        price: product.price || product.retailPrice || 0,
        quantity: selectedWeight,
        image: product.image_url || product.imageUrl,
        thcContent: product.thc_content || product.thc || 0,
        cbdContent: product.cbd_content || product.cbd || 0,
        currency: product.currency || "EUR",
      });

      toast.success(`Added ${product.name} (${selectedWeight}g) to cart!`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      toast.error("Failed to add item to cart");
    }
  };

  // Parse comma/newline separated strings into arrays
  const parseToArray = (str?: string): string[] => {
    if (!str) return [];
    return str
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  if (loading) {
    return (
      <div
        className="min-h-screen pt-20"
        style={{
          backgroundColor: "hsl(var(--tenant-color-background))",
          fontFamily: "var(--tenant-font-base, inherit)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "hsl(var(--tenant-color-primary))" }}
          />
          <p
            className="ml-4 text-lg"
            style={{ color: "hsl(var(--tenant-color-text))" }}
          >
            Loading product details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div
        className="min-h-screen pt-20"
        style={{
          backgroundColor: "hsl(var(--tenant-color-background))",
          fontFamily: "var(--tenant-font-base, inherit)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Product not found"}</AlertDescription>
          </Alert>
          <div className="text-center mt-8">
            <Link href={`${basePath}/products`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const strainColors = getStrainColor(product.type);
  const feelings = parseToArray(product.feelings);
  const helpsWith = parseToArray(product.helpsWith);
  const flavours = parseToArray(product.flavour);
  const displayPrice = product.price || product.retailPrice || 0;
  const displayCurrency = product.currency || "EUR";
  const imageUrl = product.image_url || product.imageUrl;

  return (
    <div
      className="min-h-screen pt-20"
      style={{
        backgroundColor: "hsl(var(--tenant-color-background))",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href={`${basePath}/products`}>
          <Button
            variant="ghost"
            className="mb-6 hover:bg-transparent"
            style={{ color: "hsl(var(--tenant-color-text))" }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </Link>

        {/* Main Product Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Product Image Gallery */}
          <div className="space-y-4">
            <div
              className="rounded-lg overflow-hidden bg-card relative"
              style={{
                boxShadow:
                  "var(--tenant-shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))",
                paddingBottom: "100%", // Square aspect ratio
              }}
            >
              {/* Discount Badge */}
              {product.discount && product.discount > 0 && (
                <div
                  className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-sm font-bold shadow-md"
                  style={{
                    backgroundColor: "hsl(var(--tenant-color-destructive))",
                    color: "white"
                  }}
                >
                  -{product.discount}% OFF
                </div>
              )}

              {/* Main Image - Gallery Aware */}
              {((product.strainImages && product.strainImages.length > 0) || imageUrl) ? (
                <div className="absolute inset-0 p-8 flex items-center justify-center">
                  <div className="relative w-full h-full transition-transform duration-500 hover:scale-110">
                    <Image
                      src={
                        (product.strainImages && product.strainImages.length > 0)
                          ? (product.strainImages[selectedImage]?.strainImageUrl || "")
                          : (imageUrl || "")
                      }
                      alt={product.name}
                      fill
                      className="object-contain drop-shadow-2xl"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="p-8 rounded-full"
                    style={{
                      backgroundColor: "hsl(var(--tenant-color-surface))",
                    }}
                  >
                    {getStrainIcon(product.type)}
                  </div>
                </div>
              )}

              {/* Stock Badge */}
              {/* Stock Badge - Bottom Left */}
              {product.isAvailable ? (
                <div className="absolute bottom-4 left-4 z-10">
                  <Badge className="bg-green-500 text-white">
                    <Check className="w-3 h-3 mr-1" />
                    In Stock
                  </Badge>
                </div>
              ) : null}

              {!product.isAvailable && (
                <div className="absolute top-4 right-4">
                  <Badge variant="destructive">Out of Stock</Badge>
                </div>
              )}

              {/* Popularity Badge */}
              {product.popularity && product.popularity > 70 && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-yellow-500 text-white">
                    <Star className="w-3 h-3 mr-1 fill-white" />
                    Popular
                  </Badge>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery (Only if multiple images) */}
            {product.strainImages && product.strainImages.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {product.strainImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${selectedImage === idx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    style={{
                      borderColor: selectedImage === idx ? "hsl(var(--tenant-color-primary))" : "transparent"
                    }}
                  >
                    <Image
                      src={img.strainImageUrl || ""}
                      alt={img.altText || `View ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Expiry Date */}
            {product.expiryDate && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(var(--tenant-color-text-muted))" }}>
                <AlertCircle className="w-4 h-4" />
                <span>Expires: {new Date(product.expiryDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            {/* Strain Type Badge */}
            <div className="flex items-center gap-2 mb-4">
              <Badge className={strainColors.badge}>
                {getStrainIcon(product.type)}
                <span className="ml-2">{product.type}</span>
              </Badge>
            </div>

            {/* Product Name */}
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{
                color: "hsl(var(--tenant-color-heading))",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              {product.name}
            </h1>

            {/* Description */}
            <p
              className="text-lg mb-8 leading-relaxed"
              style={{ color: "hsl(var(--tenant-color-text))" }}
            >
              {product.description}
            </p>

            {/* Cannabinoid Content */}
            <div
              className="rounded-xl p-6 mb-6"
              style={{
                backgroundColor: "hsl(var(--tenant-color-surface))",
                borderColor: "hsl(var(--tenant-color-border))",
                borderWidth: "1px",
              }}
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "hsl(var(--tenant-color-heading))" }}
              >
                Cannabinoid Profile
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p
                    className="text-sm mb-1"
                    style={{ color: "hsl(var(--tenant-color-text-muted))" }}
                  >
                    THC
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  >
                    {(product.thc_content || product.thc || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-sm mb-1"
                    style={{ color: "hsl(var(--tenant-color-text-muted))" }}
                  >
                    CBD
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "hsl(var(--tenant-color-secondary))" }}
                  >
                    {(product.cbd_content || product.cbd || 0).toFixed(1)}%
                  </p>
                </div>
                {product.cbg && product.cbg > 0 && (
                  <div className="text-center">
                    <p
                      className="text-sm mb-1"
                      style={{
                        color: "hsl(var(--tenant-color-text-muted))",
                      }}
                    >
                      CBG
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: "hsl(var(--tenant-color-accent))" }}
                    >
                      {product.cbg.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Flavours */}
            {flavours.length > 0 && (
              <div className="mb-6">
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "hsl(var(--tenant-color-heading))" }}
                >
                  Flavour Profile
                </h3>
                <div className="flex flex-wrap gap-2">
                  {flavours.map((flavour, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-sm py-1 px-3"
                    >
                      {flavour}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Feelings/Effects */}
            {feelings.length > 0 && (
              <div className="mb-6">
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "hsl(var(--tenant-color-heading))" }}
                >
                  Effects & Feelings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {feelings.map((feeling, index) => (
                    <Badge
                      key={index}
                      className="text-sm py-1 px-3"
                      style={{
                        backgroundColor: "hsl(var(--tenant-color-primary))",
                        color: "#ffffff",
                      }}
                    >
                      {feeling}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Medical Uses / Helps With */}
            {helpsWith.length > 0 && (
              <div className="mb-8">
                <h3
                  className="text-lg font-semibold mb-3"
                  style={{ color: "hsl(var(--tenant-color-heading))" }}
                >
                  Helps With
                </h3>
                <div className="flex flex-wrap gap-2">
                  {helpsWith.map((condition, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-sm py-1 px-3"
                    >
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Price & Purchase Section */}
            <div
              className="rounded-xl p-6 sticky top-24"
              style={{
                backgroundColor: "hsl(var(--tenant-color-surface))",
                borderColor: "hsl(var(--tenant-color-border))",
                borderWidth: "2px",
              }}
            >
              <div className="flex items-baseline gap-2 mb-6">
                <p
                  className="text-4xl font-bold"
                  style={{ color: "hsl(var(--tenant-color-heading))" }}
                >
                  {displayCurrency} {displayPrice.toFixed(2)}
                </p>
                <p
                  className="text-sm"
                  style={{ color: "hsl(var(--tenant-color-text-muted))" }}
                >
                  per unit
                </p>
              </div>

              {/* Quantity and Cart Controls - KYC Guarded */}
              {kycStatus === null ? (
                <div className="w-full h-20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !kycStatus.isLoggedIn ? (
                <div className="bg-muted/30 p-6 rounded-lg text-center border border-border">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">Login Required</h3>
                  <p className="text-sm text-muted-foreground mb-4">You must be logged in to purchase products.</p>
                  <Link href={`${basePath}/login`}>
                    <Button className="w-full">Login / Register</Button>
                  </Link>
                </div>
              ) : !kycStatus.kycVerified ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg text-center border border-yellow-200 dark:border-yellow-800">
                  <div className="text-yellow-600 dark:text-yellow-500 font-bold mb-2 flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Verification Required
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">
                    Your account ({kycStatus.status}) needs medical verification before you can purchase cannabis products.
                  </p>
                  <Link href={`${basePath}/dashboard`}>
                    <Button variant="outline" className="w-full border-yellow-600 text-yellow-600 hover:bg-yellow-50">Go to Dashboard</Button>
                  </Link>
                </div>
              ) : (
                <>
                  {/* Weight Selector */}
                  <div className="mb-6">
                    <p
                      className="text-sm font-medium mb-3"
                      style={{ color: "hsl(var(--tenant-color-text))" }}
                    >
                      Select Weight:
                    </p>
                    <div className="flex gap-2">
                      {[2, 5, 10].map((w) => (
                        <Button
                          key={w}
                          variant="outline"
                          className="flex-1 h-11 text-base font-bold"
                          style={{
                            backgroundColor:
                              selectedWeight === w
                                ? "hsl(var(--tenant-color-primary))"
                                : "transparent",
                            color:
                              selectedWeight === w
                                ? "#ffffff"
                                : "hsl(var(--tenant-color-text))",
                            borderColor:
                              selectedWeight === w
                                ? "hsl(var(--tenant-color-primary))"
                                : "hsl(var(--tenant-color-border))",
                          }}
                          onClick={() => setSelectedWeight(w)}
                        >
                          {w}g
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Total price display */}
                  <div className="flex items-baseline gap-2 mb-4">
                    <p
                      className="text-sm"
                      style={{ color: "hsl(var(--tenant-color-text-muted))" }}
                    >
                      Total:
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "hsl(var(--tenant-color-heading))" }}
                    >
                      {displayCurrency} {(displayPrice * selectedWeight).toFixed(2)}
                    </p>
                  </div>

                  {/* Stock Info */}
                  {product.stockQuantity > 0 && product.isAvailable && (
                    <p
                      className="text-sm mb-4"
                      style={{ color: "hsl(var(--tenant-color-success))" }}
                    >
                      ✓ In stock
                    </p>
                  )}

                  {/* Add to Cart Button */}
                  <Button
                    onClick={handleAddToCart}
                    disabled={!product.isAvailable}
                    className="w-full text-lg py-6"
                    style={{
                      backgroundColor: product.isAvailable
                        ? "hsl(var(--tenant-color-primary))"
                        : "#9ca3af",
                      color: "#ffffff",
                    }}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {product.isAvailable
                      ? `Add to Cart — ${displayCurrency} ${(displayPrice * selectedWeight).toFixed(2)}`
                      : "Out of Stock"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        <ProductSimilarSection
          similarProducts={similarProducts}
          basePath={basePath}
          productType={product.type}
          displayCurrency={displayCurrency}
        />
      </div>
    </div>
  );
}
