"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Leaf,
  Droplet,
  Package,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Plus,
  Minus,
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

interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  thc: number;
  cbd: number;
  cbg?: number;
  type: string;
  flavour?: string;
  feelings?: string;
  helpsWith?: string;
  retailPrice: number;
  stockQuantity: number;
  popularity?: number;
  isAvailable: boolean;
  strain_type?: "INDICA" | "SATIVA" | "HYBRID";
  thc_content?: number;
  cbd_content?: number;
  price?: number;
  currency?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  image_url?: string;
}

interface ApiResponse {
  success: boolean;
  data: Product;
  similarProducts?: Product[];
  error?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const addItem = useCartStore((state) => state.addItem);

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

  const getStrainIcon = (type?: string) => {
    if (!type) return <Package className="w-6 h-6" />;
    switch (type.toLowerCase()) {
      case "indica":
        return <Leaf className="w-6 h-6" />;
      case "sativa":
        return <Droplet className="w-6 h-6" />;
      default:
        return <Package className="w-6 h-6" />;
    }
  };

  const getStrainColor = (type?: string) => {
    if (!type)
      return {
        bg: "from-amber-500/20 to-orange-500/20",
        badge: "bg-amber-100 text-amber-900",
      };
    switch (type.toLowerCase()) {
      case "indica":
        return {
          bg: "from-purple-500/20 to-indigo-500/20",
          badge: "bg-purple-100 text-purple-900",
        };
      case "sativa":
        return {
          bg: "from-green-500/20 to-teal-500/20",
          badge: "bg-green-100 text-green-900",
        };
      default:
        return {
          bg: "from-amber-500/20 to-orange-500/20",
          badge: "bg-amber-100 text-amber-900",
        };
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
        quantity: quantity,
        image: product.image_url || product.imageUrl,
        thcContent: product.thc_content || product.thc || 0,
        cbdContent: product.cbd_content || product.cbd || 0,
      });

      toast.success(`Added ${quantity} ${product.name} to cart!`);
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
          backgroundColor: "var(--tenant-color-background, #ffffff)",
          fontFamily: "var(--tenant-font-base, inherit)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "var(--tenant-color-primary, #059669)" }}
          />
          <p
            className="ml-4 text-lg"
            style={{ color: "var(--tenant-color-text, #1f2937)" }}
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
          backgroundColor: "var(--tenant-color-background, #ffffff)",
          fontFamily: "var(--tenant-font-base, inherit)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Product not found"}</AlertDescription>
          </Alert>
          <div className="text-center mt-8">
            <Link href={`/store/${slug}/products`}>
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
        backgroundColor: "var(--tenant-color-background, #ffffff)",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href={`/store/${slug}/products`}>
          <Button
            variant="ghost"
            className="mb-6 hover:bg-transparent"
            style={{ color: "var(--tenant-color-text, #1f2937)" }}
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
              className={`rounded-2xl overflow-hidden bg-gradient-to-br ${strainColors.bg} relative`}
              style={{
                boxShadow:
                  "var(--tenant-shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))",
                paddingBottom: "100%", // Square aspect ratio
              }}
            >
              {imageUrl ? (
                <div className="absolute inset-0">
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="p-8 rounded-full"
                    style={{
                      backgroundColor: "var(--tenant-color-surface, #f9fafb)",
                    }}
                  >
                    {getStrainIcon(product.type)}
                  </div>
                </div>
              )}

              {/* Stock Badge */}
              {product.isAvailable && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-500 text-white">
                    <Check className="w-3 h-3 mr-1" />
                    In Stock
                  </Badge>
                </div>
              )}

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
                color: "var(--tenant-color-heading, #111827)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              {product.name}
            </h1>

            {/* Description */}
            <p
              className="text-lg mb-8 leading-relaxed"
              style={{ color: "var(--tenant-color-text, #1f2937)" }}
            >
              {product.description}
            </p>

            {/* Cannabinoid Content */}
            <div
              className="rounded-xl p-6 mb-6"
              style={{
                backgroundColor: "var(--tenant-color-surface, #f9fafb)",
                borderColor: "var(--tenant-color-border, #e5e7eb)",
                borderWidth: "1px",
              }}
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--tenant-color-heading, #111827)" }}
              >
                Cannabinoid Profile
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p
                    className="text-sm mb-1"
                    style={{ color: "var(--tenant-color-text-muted, #6b7280)" }}
                  >
                    THC
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "var(--tenant-color-primary, #059669)" }}
                  >
                    {(product.thc_content || product.thc || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className="text-sm mb-1"
                    style={{ color: "var(--tenant-color-text-muted, #6b7280)" }}
                  >
                    CBD
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: "var(--tenant-color-secondary, #10b981)" }}
                  >
                    {(product.cbd_content || product.cbd || 0).toFixed(1)}%
                  </p>
                </div>
                {product.cbg && product.cbg > 0 && (
                  <div className="text-center">
                    <p
                      className="text-sm mb-1"
                      style={{
                        color: "var(--tenant-color-text-muted, #6b7280)",
                      }}
                    >
                      CBG
                    </p>
                    <p
                      className="text-3xl font-bold"
                      style={{ color: "var(--tenant-color-accent, #8b5cf6)" }}
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
                  style={{ color: "var(--tenant-color-heading, #111827)" }}
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
                  style={{ color: "var(--tenant-color-heading, #111827)" }}
                >
                  Effects & Feelings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {feelings.map((feeling, index) => (
                    <Badge
                      key={index}
                      className="text-sm py-1 px-3"
                      style={{
                        backgroundColor: "var(--tenant-color-primary, #059669)",
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
                  style={{ color: "var(--tenant-color-heading, #111827)" }}
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
                backgroundColor: "var(--tenant-color-surface, #f9fafb)",
                borderColor: "var(--tenant-color-border, #e5e7eb)",
                borderWidth: "2px",
              }}
            >
              <div className="flex items-baseline gap-2 mb-6">
                <p
                  className="text-4xl font-bold"
                  style={{ color: "var(--tenant-color-heading, #111827)" }}
                >
                  {displayCurrency} {displayPrice.toFixed(2)}
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--tenant-color-text-muted, #6b7280)" }}
                >
                  per unit
                </p>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center gap-4 mb-6">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--tenant-color-text, #1f2937)" }}
                >
                  Quantity:
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span
                    className="text-xl font-semibold w-12 text-center"
                    style={{ color: "var(--tenant-color-text, #1f2937)" }}
                  >
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={!product.isAvailable}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Stock Info */}
              {product.stockQuantity > 0 && product.isAvailable && (
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--tenant-color-success, #10b981)" }}
                >
                  ✓ {product.stockQuantity} units available
                </p>
              )}

              {/* Add to Cart Button */}
              <Button
                onClick={handleAddToCart}
                disabled={!product.isAvailable}
                className="w-full text-lg py-6"
                style={{
                  backgroundColor: product.isAvailable
                    ? "var(--tenant-color-primary, #059669)"
                    : "#9ca3af",
                  color: "#ffffff",
                }}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {product.isAvailable ? "Add to Cart" : "Out of Stock"}
              </Button>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div
            className="border-t pt-16"
            style={{ borderColor: "var(--tenant-color-border, #e5e7eb)" }}
          >
            <h2
              className="text-3xl font-bold mb-8"
              style={{
                color: "var(--tenant-color-heading, #111827)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Similar {product.type} Products
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarProducts.map((similarProduct) => {
                const simImageUrl =
                  similarProduct.image_url || similarProduct.imageUrl;
                const simColors = getStrainColor(similarProduct.type);

                return (
                  <Link
                    key={similarProduct.id}
                    href={`/store/${slug}/products/${similarProduct.id}`}
                    className="group"
                  >
                    <div
                      className="rounded-xl overflow-hidden transition-all duration-300 hover:scale-105"
                      style={{
                        boxShadow:
                          "var(--tenant-shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
                        backgroundColor: "var(--tenant-color-surface, #ffffff)",
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
                            color: "var(--tenant-color-heading, #111827)",
                          }}
                        >
                          {similarProduct.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span
                            style={{
                              color: "var(--tenant-color-primary, #059669)",
                            }}
                          >
                            THC: {(similarProduct.thc || 0).toFixed(1)}%
                          </span>
                          <span
                            style={{
                              color: "var(--tenant-color-text-muted, #6b7280)",
                            }}
                          >
                            •
                          </span>
                          <span
                            style={{
                              color: "var(--tenant-color-secondary, #10b981)",
                            }}
                          >
                            CBD: {(similarProduct.cbd || 0).toFixed(1)}%
                          </span>
                        </div>
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: "var(--tenant-color-heading, #111827)",
                          }}
                        >
                          {displayCurrency}{" "}
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
        )}
      </div>
    </div>
  );
}
