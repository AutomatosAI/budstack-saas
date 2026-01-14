/**
 * Dr. Green Cart Management
 *
 * Helper functions for managing shopping carts via the Dr. Green API.
 * Handles cart synchronization between BudStack database and Dr. Green backend.
 */

import { prisma } from "@/lib/db";
import { callDrGreenAPI } from "@/lib/drgreen-api-client";

export interface CartItem {
  strainId: string;
  quantity: number;
  size: number; // 2, 5, or 10 grams
  strain?: {
    id: string;
    name: string;
    retailPrice: number;
    imageUrl?: string;
  };
}

export interface DrGreenCartResponse {
  items: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  drGreenCartId?: string;
}

/**
 * Get or create Dr. Green client ID for a user
 */
export async function ensureClientId(
  userId: string,
  tenantId: string,
  apiKey: string,
  secretKey: string,
): Promise<string> {
  // Check if user already has a client ID
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { drGreenClientId: true, email: true },
  });

  if (user?.drGreenClientId) {
    return user.drGreenClientId;
  }

  // Create client on Dr. Green (this would happen during consultation submission)
  // For cart purposes, we'll throw an error if no client ID exists yet
  throw new Error(
    "User must complete consultation before adding items to cart",
  );
}

/**
 * Add item to cart (or update quantity if exists)
 */
export async function addToCart(params: {
  userId: string;
  tenantId: string;
  strainId: string;
  quantity: number;
  size: number;
  apiKey: string;
  secretKey: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, strainId, quantity, size, apiKey, secretKey } =
    params;

  // Get/ensure client ID
  const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

  // Get user's cart
  let cart = await prisma.drGreenCart.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  // Calculate actual quantity (quantity * size in grams)
  const actualQuantity = quantity * size;

  // Call Dr. Green API to add to cart
  const response = await callDrGreenAPI(`/dapp/carts?clientId=${clientId}`, {
    method: "POST",
    apiKey,
    secretKey,
    validateSuccessFlag: true,
    body: {
      items: [
        {
          quantity: actualQuantity,
          strainId,
        },
      ],
      clientCartId: cart?.drGreenCartId || undefined,
    },
  });

  // Update local cart
  const cartData = (response as any).data?.clients?.[0]?.clientCart?.[0];
  if (cartData) {
    const items = cartData.cartItems.map((item: any) => ({
      strainId: item.strain.id,
      quantity: item.quantity,
      size: 1, // Dr. Green stores total quantity, so size is 1
      strain: {
        id: item.strain.id,
        name: item.strain.name,
        retailPrice: item.strain.retailPrice,
        imageUrl: item.strain.imageUrl,
      },
    }));

    if (cart) {
      // Update existing cart
      cart = await prisma.drGreenCart.update({
        where: { id: cart.id },
        data: {
          drGreenCartId: cartData.id,
          items: items,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new cart
      cart = await prisma.drGreenCart.create({
        data: {
          userId,
          tenantId,
          drGreenCartId: cartData.id,
          items: items,
        },
      });
    }

    return {
      items,
      totalQuantity: cartData.totalQuatity || 0,
      totalAmount: cartData.totalAmount || 0,
      drGreenCartId: cartData.id,
    };
  }

  throw new Error("Failed to add item to cart");
}

/**
 * Get current cart for a user
 */
export async function getCart(params: {
  userId: string;
  tenantId: string;
  apiKey: string;
  secretKey: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, apiKey, secretKey } = params;

  try {
    // Get client ID
    const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

    // Refresh from Dr. Green API
    const response = await callDrGreenAPI(`/dapp/carts?clientId=${clientId}`, {
      method: "GET",
      apiKey,
      secretKey,
      validateSuccessFlag: true,
    });

    const cartData = (response as any).data?.clients?.[0]?.clientCart?.[0];

    if (cartData) {
      const items = cartData.cartItems.map((item: any) => ({
        strainId: item.strain.id,
        quantity: item.quantity,
        size: 1,
        strain: {
          id: item.strain.id,
          name: item.strain.name,
          retailPrice: item.strain.retailPrice,
          imageUrl: item.strain.imageUrl,
        },
      }));

      // Update local cart
      await prisma.drGreenCart.upsert({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
        create: {
          userId,
          tenantId,
          drGreenCartId: cartData.id,
          items,
        },
        update: {
          drGreenCartId: cartData.id,
          items,
          updatedAt: new Date(),
        },
      });

      return {
        items,
        totalQuantity: cartData.totalQuatity || 0,
        totalAmount: cartData.totalAmount || 0,
        drGreenCartId: cartData.id,
      };
    }

    // No cart exists
    return {
      items: [],
      totalQuantity: 0,
      totalAmount: 0,
    };
  } catch (error) {
    // If user doesn't have client ID yet, return empty cart
    if (error instanceof Error && error.message.includes("consultation")) {
      return {
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      };
    }
    throw error;
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(params: {
  userId: string;
  tenantId: string;
  strainId: string;
  apiKey: string;
  secretKey: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, strainId, apiKey, secretKey } = params;

  // Get client ID
  const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

  // Get user's cart
  const cart = await prisma.drGreenCart.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!cart?.drGreenCartId) {
    throw new Error("Cart not found");
  }

  // Call Dr. Green API to remove item
  await callDrGreenAPI(
    `/dapp/carts/${cart.drGreenCartId}?strainId=${strainId}`,
    {
      method: "DELETE",
      apiKey,
      secretKey,
      validateSuccessFlag: true,
      body: { cartId: cart.drGreenCartId },
    },
  );

  // Refresh cart
  return getCart({ userId, tenantId, apiKey, secretKey });
}

/**
 * Clear entire cart
 */
export async function clearCart(params: {
  userId: string;
  tenantId: string;
  apiKey: string;
  secretKey: string;
}): Promise<void> {
  const { userId, tenantId, apiKey, secretKey } = params;

  const cart = await prisma.drGreenCart.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (cart?.drGreenCartId) {
    // Call Dr. Green API to clear cart
    await callDrGreenAPI(`/dapp/carts/${cart.drGreenCartId}`, {
      method: "DELETE",
      apiKey,
      secretKey,
      validateSuccessFlag: true,
      body: { cartId: cart.drGreenCartId },
    });
  }

  // Delete local cart record
  await prisma.drGreenCart.deleteMany({
    where: {
      userId,
      tenantId,
    },
  });
}
