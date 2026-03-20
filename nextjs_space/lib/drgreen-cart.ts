/**
 * Dr. Green Cart Management
 *
 * Helper functions for managing shopping carts via the Dr. Green API.
 * Handles cart synchronization between BudStacks database and Dr. Green backend.
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
  apiUrl?: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, strainId, quantity, size, apiKey, secretKey, apiUrl } =
    params;

  // Get/ensure client ID
  const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

  // Get user's cart
  let cart = await prisma.drgreen_carts.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  // Calculate actual quantity (quantity * size in grams)
  const actualQuantity = quantity * size;

  // Get clientCartId from client profile (clientCartId != clientId)
  // From Dr Green WordPress theme: data.clientCart[0].id
  let clientCartId: string | null = null;
  try {
    const clientResponse = await callDrGreenAPI(`/dapp/clients/${clientId}`, {
      method: "GET",
      apiKey,
      secretKey,
      baseUrl: apiUrl,
      signBody: { clientId },
    });
    const clientData = (clientResponse as any)?.data || clientResponse;
    const cartArray = clientData?.clientCart || clientData?.client?.clientCart;
    if (Array.isArray(cartArray) && cartArray.length > 0) {
      clientCartId = cartArray[0].id;
    }
  } catch {
    try {
      const listResponse = await callDrGreenAPI("/dapp/clients", {
        method: "GET",
        apiKey,
        secretKey,
        baseUrl: apiUrl,
        queryParams: { take: 200, page: 1, orderBy: 'desc' },
      });
      const clients = (listResponse as any)?.data?.clients || [];
      const match = Array.isArray(clients) ? clients.find((c: any) => c.id === clientId) : null;
      if (match?.clientCart?.[0]?.id) {
        clientCartId = match.clientCart[0].id;
      }
    } catch {
      // Will fall through
    }
  }

  if (!clientCartId) {
    throw new Error("Could not retrieve cart ID from Dr. Green client profile");
  }

  // Dr Green WordPress theme: POST /dapp/carts with {items, clientCartId}
  const response = await callDrGreenAPI('/dapp/carts', {
    method: "POST",
    apiKey,
    secretKey,
    baseUrl: apiUrl,
    body: {
      items: [{ quantity: actualQuantity, strainId }],
      clientCartId,
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
      cart = await prisma.drgreen_carts.update({
        where: { id: cart.id },
        data: {
          drGreenCartId: cartData.id,
          items: items,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new cart
      cart = await prisma.drgreen_carts.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          tenantId,
          drGreenCartId: cartData.id,
          items: items,
          updatedAt: new Date(),
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
  apiUrl?: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, apiKey, secretKey, apiUrl } = params;

  try {
    // Get client ID
    const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

    // Refresh from Dr. Green API
    const response = await callDrGreenAPI('/dapp/carts', {
      method: "GET",
      apiKey,
      secretKey,
      baseUrl: apiUrl,
      signBody: { clientId },
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
      await prisma.drgreen_carts.upsert({
        where: {
          userId_tenantId: {
            userId,
            tenantId,
          },
        },
        create: {
          id: crypto.randomUUID(),
          userId,
          tenantId,
          drGreenCartId: cartData.id,
          items,
          updatedAt: new Date(),
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
  apiUrl?: string;
}): Promise<DrGreenCartResponse> {
  const { userId, tenantId, strainId, apiKey, secretKey, apiUrl } = params;

  // Get client ID
  const clientId = await ensureClientId(userId, tenantId, apiKey, secretKey);

  // Get user's cart
  const cart = await prisma.drgreen_carts.findUnique({
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
    `/dapp/carts/${cart.drGreenCartId}`,
    {
      method: "DELETE",
      apiKey,
      secretKey,
      baseUrl: apiUrl,
      body: { cartId: cart.drGreenCartId, strainId },
    },
  );

  // Refresh cart
  return getCart({ userId, tenantId, apiKey, secretKey, apiUrl });
}

/**
 * Clear entire cart
 */
export async function clearCart(params: {
  userId: string;
  tenantId: string;
  apiKey: string;
  secretKey: string;
  apiUrl?: string;
}): Promise<void> {
  const { userId, tenantId, apiKey, secretKey, apiUrl } = params;

  const cart = await prisma.drgreen_carts.findUnique({
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
      baseUrl: apiUrl,
      body: { cartId: cart.drGreenCartId },
    });
  }

  // Delete local cart record
  await prisma.drgreen_carts.deleteMany({
    where: {
      userId,
      tenantId,
    },
  });
}
