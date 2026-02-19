/**
 * Dr. Green Order Management
 *
 * Functions for submitting orders to Dr. Green API
 */

import { prisma } from "@/lib/db";
import { callDrGreenAPI } from "@/lib/drgreen-api-client";

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
    apiUrl?: string;
    clientCartItems?: any[];
}): Promise<DrGreenOrderResponse> {
    const { userId, tenantId, shippingInfo, apiKey, secretKey, apiUrl, clientCartItems } = params;
    const log = (step: string, data?: any) => {
        console.log(`[submitOrder] ${step}`, data !== undefined ? JSON.stringify(data) : '');
    };

    log('START', { userId, tenantId, apiUrl, clientCartItemCount: clientCartItems?.length || 0 });

    // Get user's Dr. Green client ID
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { drGreenClientId: true, email: true },
    });

    log('DB_USER', {
        email: user?.email,
        drGreenClientId: user?.drGreenClientId || 'NONE',
    });

    if (!user?.drGreenClientId) {
        log('FAIL: No drGreenClientId');
        throw new Error("User must complete consultation before placing orders");
    }

    // Check server-side cart first
    let cart = await prisma.drgreen_carts.findUnique({
        where: {
            userId_tenantId: {
                userId,
                tenantId,
            },
        },
    });

    log('SERVER_CART', {
        found: !!cart,
        itemCount: cart?.items ? (cart.items as any[]).length : 0,
        drGreenCartId: cart?.drGreenCartId || 'NONE',
    });

    // If server-side cart is empty but client sent cart items, sync them to DB
    if ((!cart || !cart.items || (cart.items as any[]).length === 0) && clientCartItems?.length) {
        log('SYNCING_CLIENT_CART_TO_DB', { itemCount: clientCartItems.length });
        cart = await prisma.drgreen_carts.upsert({
            where: {
                userId_tenantId: { userId, tenantId },
            },
            create: {
                id: crypto.randomUUID(),
                userId,
                tenantId,
                items: clientCartItems,
                updatedAt: new Date(),
            },
            update: {
                items: clientCartItems,
                updatedAt: new Date(),
            },
        });
    }

    if (!cart || !cart.items || (cart.items as any[]).length === 0) {
        log('FAIL: Cart empty after sync attempt');
        throw new Error("Cart is empty. Add items before placing an order.");
    }

    const cartItems = cart.items as any[];
    log('CART_ITEMS', cartItems.map(i => ({
        strainId: i.strainId,
        name: i.strain?.name,
        qty: i.quantity,
        price: i.strain?.retailPrice,
    })));

    // Check if user is locally verified (manual override)
    const localQuestionnaire = await prisma.consultation_questionnaires.findFirst({
        where: {
            AND: [
                { tenantId: tenantId },
                { email: { equals: user.email, mode: 'insensitive' } },
                { isKycVerified: true }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    log('LOCAL_KYC_CHECK', {
        found: !!localQuestionnaire,
        id: localQuestionnaire?.id || 'NONE',
    });

    // Initialize orderData
    let orderData: any = null;
    const hasRealClientId = user.drGreenClientId && !user.drGreenClientId.startsWith("manual_test_") && !user.drGreenClientId.startsWith("MOCK_");

    log('CLIENT_ID_ANALYSIS', {
        clientId: user.drGreenClientId,
        hasRealClientId,
        isManualTest: user.drGreenClientId?.startsWith("manual_test_"),
        isMock: user.drGreenClientId?.startsWith("MOCK_"),
    });

    // Try Dr Green API first if user has a real client ID
    if (hasRealClientId) {
        log('CALLING_DR_GREEN_ORDER_API', {
            endpoint: '/dapp/orders',
            clientId: user.drGreenClientId,
            baseUrl: apiUrl,
        });
        try {
            const drGreenResponse = await callDrGreenAPI("/dapp/orders", {
                method: "POST",
                apiKey,
                secretKey,
                baseUrl: apiUrl,
                validateSuccessFlag: true,
                body: {
                    clientId: user.drGreenClientId,
                },
            });
            log('DR_GREEN_RAW_RESPONSE', drGreenResponse);
            orderData = (drGreenResponse as any).data || (drGreenResponse as any).order || drGreenResponse;
            log('DR_GREEN_ORDER_SUCCESS', orderData);
        } catch (drGreenError) {
            const errMsg = drGreenError instanceof Error ? drGreenError.message : String(drGreenError);
            log('DR_GREEN_ORDER_FAILED', {
                error: errMsg,
                hasLocalOverride: !!localQuestionnaire,
                willFallbackToMock: !!localQuestionnaire,
            });
            if (!localQuestionnaire) {
                throw drGreenError;
            }
        }
    } else {
        log('SKIPPING_DR_GREEN_API: clientId is mock/manual');
    }

    // Fallback to mock if Dr Green API failed/skipped AND user is locally verified
    if (!orderData && localQuestionnaire) {
        orderData = {
            id: `MOCK_DG_ORDER_${Date.now()}`,
            invoiceNumber: `INV_${Date.now()}`,
            status: "PENDING",
            total: 0,
        };
        log('USING_MOCK_ORDER', orderData);
    }

    // No local verification and no Dr Green client ID
    if (!orderData && !hasRealClientId) {
        log('FAIL: No order data and no real client ID');
        throw new Error("User must complete consultation before placing orders");
    }

    if (!orderData || !orderData.id) {
        log('FAIL: No order data or missing id', { orderData });
        throw new Error("Failed to create order on Dr. Green");
    }

    // Calculate order totals from cart
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + (item.strain?.retailPrice || 0) * item.quantity;
    }, 0);

    const shippingCost = 5.0; // Default shipping cost
    const total = subtotal + shippingCost;

    const order = await prisma.$transaction(async (tx: any) => {
        const createdOrder = await tx.orders.create({
            data: {
                id: crypto.randomUUID(),
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
                orderNumber: `ORD-${Date.now()}`,
                updatedAt: new Date(),
                order_items: {
                    create: cartItems.map((item) => ({
                        id: crypto.randomUUID(),
                        productId: item.strainId,
                        productName: item.strain?.name || "Unknown Product",
                        quantity: item.quantity,
                        price: item.strain?.retailPrice || 0,
                    })),
                },
            },
            include: {
                order_items: true,
            },
        });

        await tx.drgreen_carts.deleteMany({
            where: {
                userId,
                tenantId,
            },
        });

        return createdOrder;
    });

    // Only delete external cart if we didn't use the local override
    if (!localQuestionnaire && cart.drGreenCartId) {
        await callDrGreenAPI(`/dapp/carts/${cart.drGreenCartId}`, {
            method: "DELETE",
            apiKey,
            secretKey,
            baseUrl: apiUrl,
            validateSuccessFlag: true,
            body: { cartId: cart.drGreenCartId },
        });
    }

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
                {
                    method: "GET",
                    apiKey,
                    secretKey,
                    validateSuccessFlag: true,
                },
            );

            const orderDetails = (drGreenOrder as any).data?.orderDetails;

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
