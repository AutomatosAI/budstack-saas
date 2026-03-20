/**
 * Dr. Green Order Management
 *
 * 3-step order flow (reverse-engineered from partner's working CloudWatch logs):
 * Step 1: POST /dapp/carts with {"clientId"} — initialize cart for client
 * Step 2: POST /dapp/carts with {"strainId"} × N — add items one at a time
 * Step 3: POST /dapp/orders with {"clientId"} — create order from cart
 * Fallback: LOCAL order with PENDING_SYNC status
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
        select: { drGreenClientId: true, email: true, firstName: true, lastName: true, phone: true },
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

    // ========== ORDER FLOW ==========
    // Reverse-engineered from Dr Green's own WordPress dApp theme (drg-dapp-themes-1.6.0):
    //   dashboard-functions.php → dappAddToBasket() + dappPlaceOrder()
    //
    // Step 0: GET /dapp/clients/{clientId} → data.clientCart[0].id = clientCartId
    //         (clientCartId is NOT the same as clientId — it's the cart's own UUID)
    // Step 1: POST /dapp/carts with {items: [{quantity, strainId}], clientCartId}
    // Step 2: POST /dapp/orders with {clientId}
    if (hasRealClientId) {
        let lastError = '';

        const drGreenItems = cartItems.map(item => ({
            strainId: item.strainId,
            quantity: item.quantity,
        }));

        // --- Step 0: Get clientCartId from client profile ---
        let clientCartId: string | null = null;
        log('STEP_0: Fetching client profile to get clientCartId', { clientId });
        try {
            const clientResponse = await callDrGreenAPI(`/dapp/clients/${clientId}`, {
                ...apiOpts,
                method: "GET",
                signBody: { clientId },
            });
            const clientData = (clientResponse as any)?.data || clientResponse;
            const cartArray = clientData?.clientCart || clientData?.client?.clientCart;
            if (Array.isArray(cartArray) && cartArray.length > 0) {
                clientCartId = cartArray[0].id;
            }
            log('STEP_0: Client profile SUCCESS', {
                clientCartId: clientCartId || 'NOT_FOUND',
                hasShippings: !!(clientData?.shippings?.length || clientData?.client?.shippings?.length),
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log('STEP_0: Direct client GET failed, trying list fallback', { error: msg });

            // Fallback: list clients and filter (same as fetchClient in doctor-green-api.ts)
            try {
                const listResponse = await callDrGreenAPI("/dapp/clients", {
                    ...apiOpts,
                    method: "GET",
                    queryParams: { take: 200, page: 1, orderBy: 'desc' },
                });
                const clients = (listResponse as any)?.data?.clients
                    || (listResponse as any)?.data?.data
                    || (listResponse as any)?.data?.items
                    || [];
                const match = Array.isArray(clients) ? clients.find((c: any) => c.id === clientId) : null;
                if (match?.clientCart?.[0]?.id) {
                    clientCartId = match.clientCart[0].id;
                }
                log('STEP_0: List fallback result', { clientCartId: clientCartId || 'NOT_FOUND', clientsSearched: clients.length });
            } catch (e2) {
                const msg2 = e2 instanceof Error ? e2.message : String(e2);
                log('STEP_0: List fallback ALSO failed', { error: msg2 });
                lastError = msg2;
            }
        }

        // --- Step 1: Add items to cart ---
        if (clientCartId) {
            log('STEP_1: Adding items to cart', { clientCartId, items: drGreenItems });
            try {
                const cartResponse = await callDrGreenAPI("/dapp/carts", {
                    ...apiOpts,
                    method: "POST",
                    body: { items: drGreenItems, clientCartId },
                });
                log('STEP_1: Cart add SUCCESS', { keys: Object.keys(cartResponse || {}) });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log('STEP_1: Cart add FAILED', { error: msg });
                lastError = msg;
            }
        } else {
            log('STEP_1: SKIPPED — no clientCartId found, trying direct order');
        }

        // --- Step 2: Place order ---
        log('STEP_2: Placing order', { clientId });
        try {
            const drGreenResponse = await callDrGreenAPI("/dapp/orders", {
                ...apiOpts,
                method: "POST",
                body: { clientId },
            });
            orderData = (drGreenResponse as any)?.data || (drGreenResponse as any)?.order || drGreenResponse;
            log('STEP_2: Order SUCCESS', orderData);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log('STEP_2: Order FAILED', { error: msg });
            lastError = msg;
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
