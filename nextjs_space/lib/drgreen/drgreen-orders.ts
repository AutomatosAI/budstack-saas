/**
 * Dr. Green Order Management
 *
 * Order flow (from Dr Green WordPress dApp theme drg-dapp-themes-1.6.0):
 * Step 0: GET /dapp/clients/{clientId} → data.clientCart[0].id = clientCartId
 * Step 1: POST /dapp/carts with {items, clientCartId} — add items to cart
 * Step 2: POST /dapp/orders with {clientId} — create order from cart
 *
 * IMPORTANT: clientCartId != clientId — the cart has its own UUID.
 */

import { prisma } from "@/lib/db";
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { getClientCartId } from "@/lib/drgreen/drgreen-client-cart";
import { logger } from "@/lib/logger";

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
    const requestId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const log = (step: string, data?: any) => {
        logger.info(`[${requestId}] ${step}`, data !== undefined ? { data } : undefined);
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
        throw new Error("User must complete consultation before placing orders");
    }

    const clientId = user.drGreenClientId;
    if (clientId.startsWith("manual_test_") || clientId.startsWith("MOCK_")) {
        throw new Error("User must complete consultation before placing orders");
    }

    // Check server-side cart. drgreen_carts.userId is globally unique
    // (one cart per user), so look up by userId alone — not the compound
    // (userId, tenantId) key. This handles the case where a user moved
    // between flagship stores: their cart row is stamped with the old
    // tenantId and the compound lookup would miss it, then the upsert
    // below would fail with "Record not found" trying to create a second
    // row for the same userId.
    let cart = await prisma.drgreen_carts.findUnique({
        where: { userId },
    });

    log('SERVER_CART', {
        found: !!cart,
        storedTenantId: cart?.tenantId || 'NONE',
        currentTenantId: tenantId,
        itemCount: cart?.items ? (cart.items as any[]).length : 0,
        drGreenCartId: cart?.drGreenCartId || 'NONE',
    });

    // The client cart reflects what the customer has on screen RIGHT NOW and is
    // the source of truth. The persisted server-side row can be stale: it is keyed
    // by userId alone, so it survives across stores/sessions and can hold an old
    // tenantId or a strain id that Dr Green later recreated with a new id. Honoring
    // it over the live selection silently orders the wrong/dead item — and because
    // it is server-side, it re-orders that dead item in EVERY browser and on every
    // device, making Dr Green 400 the whole order no matter what the customer adds.
    // So whenever the client sends items, they WIN: overwrite the server row. Only
    // fall back to the persisted row when the request carried no cart at all.
    if (clientCartItems?.length) {
        log('CLIENT_CART_AUTHORITATIVE', {
            itemCount: clientCartItems.length,
            overwroteStaleRow: !!(cart?.items && (cart.items as any[]).length > 0),
        });
        // Build the order from the customer's live selection in memory. The
        // drgreen_carts row is only a server-side MIRROR of the cart, and writing
        // it can stall on a row lock or the connection pooler (observed ~30s on a
        // single upsert). Keep that write OFF the order's critical path — persist
        // it best-effort and non-blocking — so a slow mirror write can never delay
        // or fail a checkout. The order below uses these items directly.
        cart = { ...(cart ?? {}), userId, tenantId, items: clientCartItems } as any;
        prisma.drgreen_carts
            .upsert({
                where: { userId },
                create: { id: crypto.randomUUID(), userId, tenantId, items: clientCartItems, updatedAt: new Date() },
                update: { tenantId, items: clientCartItems, updatedAt: new Date() },
            })
            .catch((e: unknown) =>
                log('WARN: cart mirror write failed (non-blocking)', {
                    error: e instanceof Error ? e.message : String(e),
                }),
            );
    }

    if (!cart || !cart.items || (cart.items as any[]).length === 0) {
        throw new Error("Cart is empty. Add items before placing an order.");
    }

    // Normalize cart items. Live-catalog reconciliation (dropping strains Dr Green
    // discontinued or recreated) is done upstream in the order-submit route, which
    // has the tenant's MARKET country. Repeating it here would query the catalog
    // with the customer's SHIPPING country (e.g. "Portugal") and wrongly 400.
    const cartItems = (cart.items as any[]).map(item => ({
        ...item,
        price: item.price || item.strain?.retailPrice || item.retailPrice || 0,
        name: item.name || item.strain?.name || 'Unknown Product',
    }));
    log('CART_ITEMS', cartItems.map(i => ({
        strainId: i.strainId, name: i.name, qty: i.quantity, price: i.price,
    })));

    // ========== Step 0: Get clientCartId ==========
    const clientCartId = await getClientCartId(clientId, apiOpts);
    log('STEP_0: clientCartId', { clientCartId: clientCartId || 'NOT_FOUND' });

    if (!clientCartId) {
        throw new Error(
            `Could not retrieve clientCartId from Dr Green for client ${clientId}. ` +
            `Client record could not be found via /dapp/clients/{id} or list scan.`
        );
    }

    // ========== Step 1: Add items to cart ==========
    const drGreenItems = cartItems.map(item => ({
        strainId: item.strainId,
        quantity: item.quantity,
    }));

    log('STEP_1: Adding items to cart', { clientCartId, items: drGreenItems });
    await callDrGreenAPI("/dapp/carts", {
        ...apiOpts,
        method: "POST",
        body: { items: drGreenItems, clientCartId },
    });
    log('STEP_1: Cart add SUCCESS');

    // ========== Step 2: Place order ==========
    log('STEP_2: Placing order', { clientId });
    const drGreenResponse = await callDrGreenAPI("/dapp/orders", {
        ...apiOpts,
        method: "POST",
        body: { clientId },
    });
    const orderData = (drGreenResponse as any)?.data || (drGreenResponse as any)?.order || drGreenResponse;
    log('STEP_2: Order SUCCESS', orderData);

    if (!orderData?.id) {
        throw new Error("Dr. Green accepted the order but returned no order ID. Please contact support.");
    }

    // ========== Save order locally ==========
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const shippingCost = 5.0;
    const total = subtotal + shippingCost;

    log('DR_GREEN_ORDER_SUCCESS', { drGreenOrderId: orderData.id });

    // Persist the order WITHOUT an interactive transaction. The irreversible step
    // — the Dr Green order — has already succeeded above, so the local save must
    // never be killed by Prisma's 5s interactive-transaction timeout. That timeout
    // was firing AFTER Dr Green accepted the order (a slow save took ~27s), throwing
    // a false "Failed to submit order" and risking a duplicate order on retry. A
    // plain nested create is still atomic for order + items and runs to completion.
    const order = await prisma.orders.create({
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
        include: { order_items: true },
    });

    // Best-effort cart cleanup — by userId ALONE (the row can carry a stale
    // tenantId, which is exactly why an earlier compound delete matched nothing)
    // and non-blocking, since client-cart-wins overwrites any stale row next order.
    await prisma.drgreen_carts.deleteMany({ where: { userId } }).catch(() => {});

    // Invalidate cached clientCartId — Dr Green may assign a new cart after order
    const { invalidateClientCartId } = await import("@/lib/drgreen/drgreen-client-cart");
    await invalidateClientCartId(clientId).catch(() => {});

    // Clean up Dr Green server-side cart (non-blocking)
    if (cart.drGreenCartId) {
        callDrGreenAPI(`/dapp/carts/${cart.drGreenCartId}`, {
            method: "DELETE",
            apiKey,
            secretKey,
            baseUrl: apiUrl,
            body: { cartId: cart.drGreenCartId },
        }).catch(e => {
            log('WARN: Failed to delete Dr Green cart (non-blocking)', {
                cartId: cart!.drGreenCartId,
                error: e instanceof Error ? e.message : String(e),
            });
        });
    }

    return {
        orderId: order.id,
        drGreenOrderId: orderData.id,
        orderNumber: order.orderNumber,
        status: "PENDING",
        total: order.total,
        message: "Order submitted successfully. Payment instructions will be emailed to you once approved by admin.",
    };
}

/**
 * Direct pay-at-checkout: ask Dr Green to mint a PayCloud hosted checkout for
 * an EXISTING order and return its pay_url, so the storefront can redirect the
 * customer to pay immediately instead of a link being emailed on admin
 * approval. Hits POST /payments/checkout on the same /api/v1 base the dapp
 * flow uses; callDrGreenAPI signs the body for Dr Green's DualAuthGuard.
 */
export async function createDirectCheckout(params: {
    drGreenOrderId: string;
    returnUrl: string;
    apiKey: string;
    secretKey: string;
    apiUrl?: string;
}): Promise<{ orderId: string; payUrl: string; expiresAt: string }> {
    const { drGreenOrderId, returnUrl, apiKey, secretKey, apiUrl } = params;
    const res = await callDrGreenAPI<any>("/payments/checkout", {
        apiKey,
        secretKey,
        baseUrl: apiUrl,
        method: "POST",
        body: { orderId: drGreenOrderId, returnUrl },
    });
    // Dr Green responses are sometimes wrapped in { data }, sometimes raw.
    const data = res?.data || res;
    return {
        orderId: data.orderId,
        payUrl: data.payUrl,
        expiresAt: data.expiresAt,
    };
}

/**
 * Definitive payment status for a direct-pay order. PayCloud's return URL
 * carries no reliable status, so this hits Dr Green's live order.query-backed
 * endpoint: paid | failed | pending | cancelled | expired | refunded. A "paid"
 * result has self-healed the Dr Green order to PAID even if the webhook was
 * late. GET with a path param → DualAuthGuard signs JSON.stringify(req.params),
 * so we sign { orderId } (same convention as getOrder).
 */
export async function getDirectCheckoutStatus(params: {
    drGreenOrderId: string;
    apiKey: string;
    secretKey: string;
    apiUrl?: string;
}): Promise<{ orderId: string; state: string; paymentStatus: string }> {
    const { drGreenOrderId, apiKey, secretKey, apiUrl } = params;
    const res = await callDrGreenAPI<any>(
        `/payments/checkout/${drGreenOrderId}/status`,
        {
            apiKey,
            secretKey,
            baseUrl: apiUrl,
            method: "GET",
            signBody: { orderId: drGreenOrderId },
        },
    );
    const data = res?.data || res;
    return {
        orderId: data.orderId,
        state: data.state,
        paymentStatus: data.paymentStatus,
    };
}

/**
 * Void an unpaid direct-pay order (customer abandoned payment). Dr Green
 * re-checks PayCloud first, so a payment that actually completed is reported
 * paid and never voided. POST → DualAuthGuard signs JSON.stringify(req.body),
 * so we send { orderId } as the (signed) body; the server reads the id from the
 * path param.
 */
export async function cancelDirectCheckout(params: {
    drGreenOrderId: string;
    apiKey: string;
    secretKey: string;
    apiUrl?: string;
}): Promise<{ orderId: string; state: string; cancelled: boolean }> {
    const { drGreenOrderId, apiKey, secretKey, apiUrl } = params;
    const res = await callDrGreenAPI<any>(
        `/payments/checkout/${drGreenOrderId}/cancel`,
        {
            apiKey,
            secretKey,
            baseUrl: apiUrl,
            method: "POST",
            body: { orderId: drGreenOrderId },
        },
    );
    const data = res?.data || res;
    return {
        orderId: data.orderId,
        state: data.state,
        cancelled: data.cancelled,
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

    const order = await prisma.orders.findFirst({
        where: { id: orderId, userId, tenantId },
        include: { items: true },
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.drGreenOrderId) {
        try {
            const drGreenOrder = await callDrGreenAPI(
                `/dapp/orders/${order.drGreenOrderId}`,
                {
                    method: "GET",
                    apiKey,
                    secretKey,
                    // GET with path param, no query — DualAuthGuard signs
                    // JSON.stringify(req.params). See doctor-green-api.ts fetchClient.
                    signBody: { orderId: order.drGreenOrderId },
                },
            );

            const orderDetails = (drGreenOrder as any).data?.orderDetails;
            if (orderDetails?.paymentStatus === "PAID" && order.paymentStatus !== "PAID") {
                return prisma.orders.update({
                    where: { id: order.id },
                    data: { paymentStatus: "PAID" },
                    include: { items: true },
                });
            }
        } catch (error) {
            console.error("[Order Sync] Failed to sync with Dr. Green:", error);
        }
    }

    return order;
}
