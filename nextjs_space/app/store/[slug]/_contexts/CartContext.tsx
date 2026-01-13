"use client";

/**
 * Cart Context Provider
 *
 * Manages shopping cart state across the application
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface CartItem {
  strainId: string;
  quantity: number;
  size: number;
  strain?: {
    id: string;
    name: string;
    retailPrice: number;
    imageUrl?: string;
  };
}

interface Cart {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  drGreenCartId?: string;
}

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;
  addToCart: (
    strainId: string,
    quantity: number,
    size: number,
  ) => Promise<void>;
  removeFromCart: (strainId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({
  children,
  storeSlug,
}: {
  children: React.ReactNode;
  storeSlug: string;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/store/${storeSlug}/cart`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch cart");
      }

      setCart(data.cart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cart");
      console.error("[Cart] Error fetching cart:", err);
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  const addToCart = useCallback(
    async (strainId: string, quantity: number, size: number) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/store/${storeSlug}/cart/add`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ strainId, quantity, size }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to add item to cart");
        }

        setCart(data.cart);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add to cart");
        throw err; // Re-throw so UI can show error
      } finally {
        setIsLoading(false);
      }
    },
    [storeSlug],
  );

  const removeFromCart = useCallback(
    async (strainId: string) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/store/${storeSlug}/cart/remove?strainId=${strainId}`,
          { method: "DELETE" },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to remove item");
        }

        setCart(data.cart);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to remove from cart",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [storeSlug],
  );

  const clearCart = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/store/${storeSlug}/cart/clear`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to clear cart");
      }

      setCart({
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear cart");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  // Load cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const value: CartContextType = {
    cart,
    isLoading,
    error,
    addToCart,
    removeFromCart,
    clearCart,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
