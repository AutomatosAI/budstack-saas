import { create } from "zustand";
import { persist } from "zustand/middleware";

export const WEIGHT_OPTIONS = [2, 5, 10] as const;

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;       // price per gram
  quantity: number;     // weight in grams (2, 5, or 10)
  image?: string;
  thcContent?: number;
  cbdContent?: number;
  currency?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      // One entry per strain — adding same strain replaces weight
      addItem: (item) => {
        const existingItem = get().items.find(
          (i) => i.productId === item.productId,
        );

        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: item.quantity, price: item.price }
                : i,
            ),
          });
        } else {
          set({
            items: [...get().items, item],
          });
        }
      },

      removeItem: (productId) => {
        set({
          items: get().items.filter((i) => i.productId !== productId),
        });
      },

      // Update weight (quantity = grams)
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
        } else {
          set({
            items: get().items.map((i) =>
              i.productId === productId ? { ...i, quantity } : i,
            ),
          });
        }
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.length;
      },

      // Total = sum of (price_per_gram × weight_in_grams)
      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
      },
    }),
    {
      name: "budstack-cart",
    },
  ),
);
