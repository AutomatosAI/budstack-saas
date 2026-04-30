"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, GripVertical, Search, X, Package, Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  type?: string;
  imageUrl?: string;
  image_url?: string;
  retailPrice?: number;
  price?: number;
  isAvailable?: boolean;
  in_stock?: boolean;
}

interface ProductPickerProps {
  /** Comma-separated product IDs */
  value: string;
  onChange: (value: string) => void;
}

export function ProductPicker({ value, onChange }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingCredentials, setMissingCredentials] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = value ? value.split(",").filter(Boolean) : [];

  // Fetch all products for this tenant
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setMissingCredentials(false);
      try {
        const res = await fetch("/api/tenant-admin/products/list");
        if (!res.ok) throw new Error("Failed to load products");
        const data = await res.json();
        if (!cancelled) {
          if (data.missingCredentials) {
            setMissingCredentials(true);
            setProducts([]);
          } else {
            setProducts(data.data || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load products");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const toggleProduct = useCallback(
    (id: string) => {
      const current = value ? value.split(",").filter(Boolean) : [];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      onChange(next.join(","));
    },
    [value, onChange],
  );

  const removeProduct = useCallback(
    (id: string) => {
      const next = selectedIds.filter((x) => x !== id);
      onChange(next.join(","));
    },
    [selectedIds, onChange],
  );

  const moveProduct = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= selectedIds.length) return;
      const updated = [...selectedIds];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      onChange(updated.join(","));
    },
    [selectedIds, onChange],
  );

  const getProductImage = (p: Product) => p.imageUrl || p.image_url || null;
  const getProductPrice = (p: Product) => p.retailPrice ?? p.price ?? 0;

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.type || "").toLowerCase().includes(search.toLowerCase()),
  );

  // Selected products in order
  const selectedProducts = selectedIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean) as Product[];

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-bs-fg-muted">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading products...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 text-sm text-bs-danger">
        {error}
      </div>
    );
  }

  if (missingCredentials) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-bs-warn">
        <Package className="w-4 h-4" aria-hidden="true" />
        Dr Green API not configured. Set up your API keys in Settings first, then sync your products.
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-bs-fg-muted">
        <Package className="w-4 h-4" aria-hidden="true" />
        No products found. Sync your products from the Products tab first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected products — reorderable */}
      {selectedProducts.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-bs-fg-muted">
            {selectedProducts.length} selected — drag to reorder
          </Label>
          {selectedProducts.map((product, index) => (
            <div
              key={product.id}
              className="flex items-center gap-2 p-2 rounded-bs-sm border bg-bs-green/5 border-bs-green/20"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  className="text-bs-fg-muted hover:text-bs-fg disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => moveProduct(index, -1)}
                  aria-label="Move up"
                >
                  <GripVertical className="w-3 h-3 rotate-180" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="text-bs-fg-muted hover:text-bs-fg disabled:opacity-30"
                  disabled={index === selectedProducts.length - 1}
                  onClick={() => moveProduct(index, 1)}
                  aria-label="Move down"
                >
                  <GripVertical className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
              {getProductImage(product) && (
                <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                  <Image
                    src={getProductImage(product)!}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              )}
              <span className="text-sm font-medium flex-1 truncate text-bs-fg">{product.name}</span>
              <button
                type="button"
                onClick={() => removeProduct(product.id)}
                className="text-bs-fg-muted hover:text-bs-danger"
                aria-label="Remove product"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + product grid */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-bs-fg-muted" aria-hidden="true" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="max-h-64 overflow-y-auto border border-bs-border-100 rounded-bs-sm divide-y divide-bs-border-100">
        {filtered.map((product) => {
          const isSelected = selectedIds.includes(product.id);
          const img = getProductImage(product);

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => toggleProduct(product.id)}
              className={cn(
                "flex items-center gap-3 w-full p-2.5 text-left hover:bg-bs-card-2/50 transition-colors",
                isSelected && "bg-bs-green/5",
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected
                    ? "border-bs-green bg-bs-green text-bs-canvas"
                    : "border-bs-border-200",
                )}
              >
                {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
              </div>
              {img && (
                <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
                  <Image src={img} alt={product.name} fill className="object-cover" sizes="40px" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-bs-fg">{product.name}</p>
                <p className="text-xs text-bs-fg-muted">
                  {product.type || "Product"}
                  {getProductPrice(product) > 0 && (
                    <> &middot; {new Intl.NumberFormat(undefined, { style: "currency", currency: "ZAR" }).format(getProductPrice(product))}</>
                  )}
                </p>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-bs-fg-muted text-center">No products match your search.</p>
        )}
      </div>
    </div>
  );
}
