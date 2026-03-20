/**
 * Dr. Green Order Management
 *
 * 3-step atomic order flow (matching reference implementation):
 * Step 1: PATCH /dapp/clients/{id} — update shipping address
 * Step 2: POST /dapp/carts — add items to Dr Green server-side cart
 * Step 3: POST /dapp/orders — create order from cart
 * Fallback: POST /dapp/orders with items[] — direct order creation
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
        countryCode?: string;
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

// Country name/code to Alpha-3 ISO mapping
const COUNTRY_TO_ALPHA3: Record<string, string> = {
    'south africa': 'ZAF', 'za': 'ZAF',
    'portugal': 'PRT', 'pt': 'PRT',
    'united kingdom': 'GBR', 'uk': 'GBR', 'gb': 'GBR',
    'thailand': 'THA', 'th': 'THA',
    'united states': 'USA', 'usa': 'USA', 'us': 'USA',
    'germany': 'DEU', 'de': 'DEU',
    'france': 'FRA', 'fr': 'FRA',
    'spain': 'ESP', 'es': 'ESP',
    'italy': 'ITA', 'it': 'ITA',
    'netherlands': 'NLD', 'nl': 'NLD',
    'ireland': 'IRL', 'ie': 'IRL',
    'brazil': 'BRA', 'br': 'BRA',
    'canada': 'CAN', 'ca': 'CAN',
    'australia': 'AUS', 'au': 'AUS',
};

function toAlpha3CountryCode(country: string): string {
    return COUNTRY_TO_ALPHA3[country.toLowerCase().trim()] || country;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Submit order to Dr. Green using 3-step atomic flow
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
    const requestId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const log = (step: string, data?: any) => {
        console.log(`[${requestId}] ${step}`, data !== undefined ? JSON.stringify(data) : '');
    };
    const apiOpts = { apiKey, secretKey, baseUrl: apiUrl };

    log('START', { userId, tenantId, apiUrl, clientCartItemCount: clientCartItems?.length || 0 });

    // Get user's Dr. Green client ID
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { drGreenClientId: true, email: true },
    });

    log('DB_USER', { email: user?.email, drGreenClientId: user?.drGreenClientId || 'NONE' });

    if (!user?.drGreenClientId) {
        log('FAIL: No drGreenClientId');
        throw new Error("User must complete consultation before placing orders");
    }

    // Check server-side cart first
    let cart = await prisma.drgreen_carts.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
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
            where: { userId_tenantId: { userId, tenantId } },
            create: { id: crypto.randomUUID(), userId, tenantId, items: clientCartItems, updatedAt: new Date() },
            update: { items: clientCartItems, updatedAt: new Date() },
        });
    }

    if (!cart || !cart.items || (cart.items as any[]).length === 0) {
        log('FAIL: Cart empty');
        throw new Error("Cart is empty. Add items before placing an order.");
    }

    // Normalize cart items: ensure every item has a top-level `price` and `name`
    // Items may come from different sources with different shapes:
    //   - Server-side cart (drgreen-cart.ts): { strainId, quantity, strain: { retailPrice, name } }
    //   - Client-side cart (checkout): { strainId, quantity, strain: { retailPrice, name } }
    //   - Flat format (template style): { strainId, quantity, price, name }
    const cartItems = (cart.items as any[]).map(item => ({
        ...item,
        price: item.price || item.strain?.retailPrice || item.retailPrice || 0,
        name: item.name || item.strain?.name || 'Unknown Product',
    }));
    log('CART_ITEMS', cartItems.map(i => ({
        strainId: i.strainId, name: i.name, qty: i.quantity, price: i.price,
    })));

    let orderData: any = null;
    const clientId = user.drGreenClientId;
    const hasRealClientId = clientId && !clientId.startsWith("manual_test_") && !clientId.startsWith("MOCK_");

    log('CLIENT_ID_ANALYSIS', { clientId, hasRealClientId });

    // ========== 3-STEP ATOMIC ORDER FLOW ==========
    if (hasRealClientId) {
        let stepFailed = '';
        let lastError = '';
        const countryCode = shippingInfo.countryCode || toAlpha3CountryCode(shippingInfo.country);

        // Step 1: Update client shipping address on Dr Green
        const shippingPayload = {
            address1: shippingInfo.address1,
            address2: shippingInfo.address2 || '',
            landmark: '',
            city: shippingInfo.city,
            state: shippingInfo.state || shippingInfo.city,
            country: shippingInfo.country,
            countryCode: countryCode,
            postalCode: shippingInfo.postalCode,
        };
        log('STEP_1: Updating client shipping address', { clientId, shipping: shippingPayload });
        try {
            const patchResponse = await callDrGreenAPI<any>(`/dapp/clients/${clientId}`, {
                ...apiOpts,
                method: "PATCH",
                body: shippingPayload,
            });
            // Verify shipping persisted (template checks this for credential scope)
            const returnedShipping = patchResponse?.data?.shipping || patchResponse?.shipping;
            if (returnedShipping && returnedShipping.address1) {
                log('STEP_1: Shipping verified in response', {
                    address1: returnedShipping.address1,
                    city: returnedShipping.city,
                });
            } else {
                log('STEP_1: Shipping NOT confirmed in response (credential scope issue)', {
                    success: patchResponse?.success,
                    dataKeys: patchResponse?.data ? Object.keys(patchResponse.data) : [],
                });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log('STEP_1: Shipping PATCH failed (non-blocking)', { error: msg });
            // Non-blocking — continue anyway (same as reference)
        }

        // Wait for propagation (Lovable uses 1500ms)
        log('STEP_1: Waiting 1500ms for propagation');
        await sleep(1500);

        // Step 2: Add items to Dr Green server-side cart (with retry)
        const drGreenCartItems = cartItems.map(item => ({
            strainId: item.strainId,
            quantity: item.quantity,
        }));
        const cartPayload = { clientCartId: clientId, items: drGreenCartItems };

        log('STEP_2: Adding items to Dr Green cart', { itemCount: drGreenCartItems.length, payload: cartPayload });

        let cartSuccess = false;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await callDrGreenAPI("/dapp/carts", {
                    ...apiOpts,
                    method: "POST",
                    body: cartPayload,
                });
                log(`STEP_2: Cart add success (attempt ${attempt})`);
                cartSuccess = true;
                break;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log(`STEP_2: Cart add failed (attempt ${attempt})`, { error: msg });
                lastError = msg;

                if (msg.includes("shipping address not found") && attempt < maxAttempts) {
                    const delay = attempt * 2000;
                    log(`STEP_2: Retrying in ${delay}ms (shipping propagation)`);
                    await sleep(delay);
                } else if (attempt < maxAttempts) {
                    await sleep(1000);
                }
            }
        }

        // Step 3: Create order from cart
        if (cartSuccess) {
            log('STEP_3: Creating order from cart');
            try {
                const drGreenResponse = await callDrGreenAPI("/dapp/orders", {
                    ...apiOpts,
                    method: "POST",
                    body: { clientId },
                });
                orderData = (drGreenResponse as any).data || (drGreenResponse as any).order || drGreenResponse;
                log('STEP_3: Cart-order SUCCESS', orderData);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log('STEP_3: Cart-order FAILED', { error: msg });
                stepFailed = 'cart-order';
                lastError = msg;
            }
        } else {
            stepFailed = 'cart-add';
        }

        // Fallback: Direct order creation with items + shippingAddress in payload
        // This bypasses the cart flow entirely (which requires shipping saved on client)
        // Matches Lovable's working fallback pattern
        if (!orderData) {
            log('STEP_3_FALLBACK: Attempting direct order with items + shippingAddress', { previousStep: stepFailed });

            // Build items with price — always include price for Dr Green to calculate totals
            const directItems = cartItems.map(item => ({
                strainId: item.strainId,
                quantity: item.quantity,
                price: item.price,
            }));

            const directPayload: Record<string, any> = {
                clientId,
                items: directItems,
                shippingAddress: {
                    address1: shippingInfo.address1,
                    address2: shippingInfo.address2 || '',
                    city: shippingInfo.city,
                    state: shippingInfo.state || shippingInfo.city,
                    country: shippingInfo.country,
                    countryCode: countryCode,
                    postalCode: shippingInfo.postalCode,
                },
            };

            log('STEP_3_FALLBACK: Payload', {
                itemCount: directItems.length,
                hasShipping: true,
                country: shippingInfo.country,
            });

            try {
                const drGreenResponse = await callDrGreenAPI("/dapp/orders", {
                    ...apiOpts,
                    method: "POST",
                    body: directPayload,
                });
                orderData = (drGreenResponse as any).data || (drGreenResponse as any).order || drGreenResponse;
                log('STEP_3_FALLBACK: Direct order SUCCESS', orderData);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log('STEP_3_FALLBACK: Direct order FAILED — will use local fallback', { error: msg });
                lastError = msg;
                // Don't throw — fall through to local fallback below
            }
        }
    } else {
        log('FAIL: No real Dr Green client ID');
        throw new Error("User must complete consultation before placing orders");
    }

    // Calculate order totals from normalized cart items
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + (item.price || 0) * item.quantity;
    }, 0);
    const shippingCost = 5.0;
    const total = subtotal + shippingCost;

    // ========== LOCAL-FIRST FALLBACK (copied from template Checkout.tsx) ==========
    // When ALL Dr Green API steps fail, create a local order with PENDING_SYNC
    // so the user still gets a success response and admin can sync later
    if (!orderData || !orderData.id) {
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const localOrderId = `LOCAL-${datePart}-${rand}`;

        log('LOCAL_FALLBACK: All Dr Green API steps failed — creating local order', {
            localOrderId,
            subtotal,
            total,
            itemCount: cartItems.length,
        });

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
                    status: "PENDING_SYNC",
                    paymentStatus: "AWAITING_PROCESSING",
                    drGreenOrderId: localOrderId,
                    orderNumber: localOrderId,
                    updatedAt: new Date(),
                    order_items: {
                        create: cartItems.map((item) => ({
                            id: crypto.randomUUID(),
                            productId: item.strainId,
                            productName: item.name,
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                },
                include: {
                    order_items: true,
                },
            });

            await tx.drgreen_carts.deleteMany({
                where: { userId, tenantId },
            });

            return createdOrder;
        });

        log('LOCAL_FALLBACK: Order created successfully', {
            orderId: order.id,
            localOrderId,
        });

        return {
            orderId: order.id,
            drGreenOrderId: localOrderId,
            orderNumber: localOrderId,
            status: "PENDING_SYNC",
            total: order.total,
            message: "Order received and saved. Our team will process it shortly.",
        };
    }

    // ========== DR GREEN API ORDER SUCCEEDED ==========
    log('DR_GREEN_ORDER_SUCCESS', { drGreenOrderId: orderData.id });

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
                        productName: item.name,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: {
                order_items: true,
            },
        });

        await tx.drgreen_carts.deleteMany({
            where: { userId, tenantId },
        });

        return createdOrder;
    });

    // Clean up Dr Green server-side cart after successful order
    if (cart.drGreenCartId) {
        try {
            await callDrGreenAPI(`/dapp/carts/${cart.drGreenCartId}`, {
                method: "DELETE",
                apiKey,
                secretKey,
                baseUrl: apiUrl,
                body: { cartId: cart.drGreenCartId },
            });
        } catch (e) {
            log('WARN: Failed to delete Dr Green cart (non-blocking)', {
                cartId: cart.drGreenCartId,
                error: e instanceof Error ? e.message : String(e),
            });
        }
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
