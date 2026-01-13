/**
 * Dr. Green Order Management
 *
 * Functions for submitting orders to Dr. Green API
 */

import { prisma } from '@/lib/db';
import { callDrGreenAPI } from '@/lib/drgreen-api-client';

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
        throw new Error('User must complete consultation before placing orders');
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
        throw new Error('Cart is empty. Add items before placing an order.');
    }

    // Submit order to Dr. Green API
    const drGreenResponse = await callDrGreenAPI(
        '/dapp/orders',
        {
            method: 'POST',
            apiKey,
            secretKey,
            validateSuccessFlag: true,
            body: {
                clientId: user.drGreenClientId,
            },
        }
    );

    const orderData = drGreenResponse.data;

    if (!orderData || !orderData.id) {
        throw new Error('Failed to create order on Dr. Green');
    }

    // Calculate order totals from cart
    const cartItems = cart.items as any[];
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + (item.strain?.retailPrice || 0) * item.quantity;
    }, 0);

    const shippingCost = 5.00; // Default shipping cost
    const total = subtotal + shippingCost;

    const order = await prisma.$transaction(async (tx) => {
        const createdOrder = await tx.orders.create({
            data: {
                userId,
                tenantId,
                subtotal,
                shippingCost,
                total,
                shippingInfo: shippingInfo as any,
                status: 'PENDING',
                paymentStatus: 'PENDING',
                drGreenOrderId: orderData.id,
                drGreenInvoiceNum: orderData.invoiceNumber,
                items: {
                    create: cartItems.map((item) => ({
                        productId: item.strainId,
                        productName: item.strain?.name || 'Unknown Product',
                        quantity: item.quantity,
                        price: item.strain?.retailPrice || 0,
                    })),
                },
            },
            include: {
                items: true,
            },
        });

        await tx.drGreenCart.deleteMany({
            where: {
                userId,
                tenantId,
            },
        });

        return createdOrder;
    });

    if (cart.drGreenCartId) {
        await callDrGreenAPI(
            `/dapp/carts/${cart.drGreenCartId}`,
            {
                method: 'DELETE',
                apiKey,
                secretKey,
                validateSuccessFlag: true,
                body: { cartId: cart.drGreenCartId },
            }
        );
    }

    return {
        orderId: order.id,
        drGreenOrderId: orderData.id,
        orderNumber: order.orderNumber,
        status: 'PENDING',
        total: order.total,
        message: 'Order submitted successfully. Payment instructions will be emailed to you once approved by admin.',
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

    if (!order) {
        throw new Error('Order not found');
    }

    // If order has Dr. Green ID, sync latest status
    if (order.drGreenOrderId) {
        try {
            const drGreenOrder = await callDrGreenAPI(
                `/dapp/orders/${order.drGreenOrderId}`,
                {
                    method: 'GET',
                    apiKey,
                    secretKey,
                    validateSuccessFlag: true,
                }
            );

            const orderDetails = drGreenOrder.data?.orderDetails;

            if (orderDetails) {
                // Update local order with latest Dr. Green status
                const updated = await prisma.orders.update({
                    where: { id: order.id },
                    data: {
                        // Map Dr. Green payment status to local
                        paymentStatus: orderDetails.paymentStatus === 'PAID' ? 'PAID' : order.paymentStatus,
                    },
                    include: {
                        items: true,
                    },
                });

                return updated;
            }
        } catch (error) {
            console.error('[Order Sync] Failed to sync with Dr. Green:', error);
            // Return local order if sync fails
        }
    }
  }

  return order;
}
