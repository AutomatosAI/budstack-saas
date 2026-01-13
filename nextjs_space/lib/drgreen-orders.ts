/**
 * Dr. Green Order Management
 *
 * Functions for submitting orders to Dr. Green API
 */

import { prisma } from "@/lib/db";
import crypto from "crypto";
import { clearCart } from "./drgreen-cart";

export interface OrderSubmissionData {
  shippingInfo: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface DrGreenOrderResponse {
  orderId: string;
  drGreenOrderId: string;
  orderNumber: string;
  status: string;
  total: number;
  message: string;
}

/**
 * Generate RSA-SHA256 signature for Dr. Green API
 */
function generateDrGreenSignature(payload: string, secretKey: string): string {
  const privateKeyPEM = Buffer.from(secretKey, "base64").toString("utf-8");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(payload);
  return sign.sign(privateKeyPEM, "base64");
}

/**
 * Make authenticated request to Dr. Green API
 */
async function callDrGreenAPI(
  endpoint: string,
  method: "GET" | "POST",
  apiKey: string,
  secretKey: string,
  body?: any,
): Promise<any> {
  const apiUrl =
    process.env.DRGREEN_API_URL || "https://api.drgreennft.com/api/v1";
  const url = `${apiUrl}${endpoint}`;

  const payload = body ? JSON.stringify(body) : "";
  const signature = generateDrGreenSignature(payload || endpoint, secretKey);

  const response = await fetch(url, {
    method,
    headers: {
      "x-auth-apikey": apiKey,
      "x-auth-signature": signature,
      "Content-Type": "application/json",
    },
    body: body ? payload : undefined,
  });

  const data = await response.json();

  if (!response.ok || data.success !== "true") {
    throw new Error(
      data.message || `Dr. Green API error: ${response.statusText}`,
    );
  }

  return data;
}

/**
 * Submit order to Dr. Green
 */
export async function submitOrder(params: {
  userId: string;
  tenantId: string;
  shippingInfo: OrderSubmissionData["shippingInfo"];
  apiKey: string;
  secretKey: string;
}): Promise<DrGreenOrderResponse> {
  const { userId, tenantId, shippingInfo, apiKey, secretKey } = params;

  // Get user's Dr. Green client ID
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { drGreenClientId: true, email: true },
  });

  if (!user?.drGreenClientId) {
    throw new Error("User must complete consultation before placing orders");
  }

  // Verify user has items in cart
  const cart = await prisma.drGreenCart.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!cart || !cart.items || (cart.items as any[]).length === 0) {
    throw new Error("Cart is empty. Add items before placing an order.");
  }

  // Submit order to Dr. Green API
  const drGreenResponse = await callDrGreenAPI(
    "/dapp/orders",
    "POST",
    apiKey,
    secretKey,
    {
      clientId: user.drGreenClientId,
    },
  );

  const orderData = drGreenResponse.data;

  if (!orderData || !orderData.id) {
    throw new Error("Failed to create order on Dr. Green");
  }

  // Calculate order totals from cart
  const cartItems = cart.items as any[];
  const subtotal = cartItems.reduce((sum, item) => {
    return sum + (item.strain?.retailPrice || 0) * item.quantity;
  }, 0);

  const shippingCost = 5.0; // Default shipping cost
  const total = subtotal + shippingCost;

  // Create local order record
  const order = await prisma.orders.create({
    data: {
      userId,
      tenantId,
      subtotal,
      shippingCost,
      total,
      shippingInfo: shippingInfo as any,
      status: "PENDING",
      paymentStatus: "PENDING",
      drGreenOrderId: orderData.id,
      drGreenInvoiceNum: orderData.invoiceNumber,
      items: {
        create: cartItems.map((item) => ({
          productId: item.strainId,
          productName: item.strain?.name || "Unknown Product",
          quantity: item.quantity,
          price: item.strain?.retailPrice || 0,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  // Clear user's cart
  await clearCart({
    userId,
    tenantId,
    apiKey,
    secretKey,
  });

  return {
    orderId: order.id,
    drGreenOrderId: orderData.id,
    orderNumber: order.orderNumber,
    status: "PENDING",
    total: order.total,
    message:
      "Order submitted successfully. Payment instructions will be emailed to you once approved by admin.",
  };
}

/**
 * Get order by ID (with Dr. Green sync)
 */
export async function getOrder(params: {
  orderId: string;
  userId: string;
  tenantId: string;
  apiKey: string;
  secretKey: string;
}): Promise<any> {
  const { orderId, userId, tenantId, apiKey, secretKey } = params;

  // Get local order
  const order = await prisma.orders.findFirst({
    where: {
      id: orderId,
      userId,
      tenantId,
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // If order has Dr. Green ID, sync latest status
  if (order.drGreenOrderId) {
    try {
      const drGreenOrder = await callDrGreenAPI(
        `/dapp/orders/${order.drGreenOrderId}`,
        "GET",
        apiKey,
        secretKey,
      );

      const orderDetails = drGreenOrder.data?.orderDetails;

      if (orderDetails) {
        // Update local order with latest Dr. Green status
        const updated = await prisma.orders.update({
          where: { id: order.id },
          data: {
            // Map Dr. Green payment status to local
            paymentStatus:
              orderDetails.paymentStatus === "PAID"
                ? "PAID"
                : order.paymentStatus,
          },
          include: {
            items: true,
          },
        });

        return updated;
      }
    } catch (error) {
      console.error("[Order Sync] Failed to sync with Dr. Green:", error);
      // Return local order if sync fails
    }
  }

  return order;
}
