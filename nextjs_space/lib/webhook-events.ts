/**
 * Webhook Events Configuration
 *
 * Client-safe constants for webhook events.
 * This file can be imported from both client and server components.
 */

/**
 * Available webhook events
 */
export const WEBHOOK_EVENTS = {
    // Tenant Events
    TENANT_CREATED: "tenant.created",
    TENANT_UPDATED: "tenant.updated",
    TENANT_ACTIVATED: "tenant.activated",
    TENANT_DEACTIVATED: "tenant.deactivated",

    // Product Events
    PRODUCT_CREATED: "product.created",
    PRODUCT_UPDATED: "product.updated",
    PRODUCT_DELETED: "product.deleted",
    PRODUCT_LOW_STOCK: "product.low_stock",
    PRODUCT_OUT_OF_STOCK: "product.out_of_stock",

    // Order Events
    ORDER_CREATED: "order.created",
    ORDER_CONFIRMED: "order.confirmed",
    ORDER_SHIPPED: "order.shipped",
    ORDER_DELIVERED: "order.delivered",
    ORDER_CANCELLED: "order.cancelled",

    // Consultation Events
    CONSULTATION_SUBMITTED: "consultation.submitted",
    CONSULTATION_APPROVED: "consultation.approved",
    CONSULTATION_REJECTED: "consultation.rejected",

    // Dr. Green Payment Events
    DRGREEN_PAYMENT_RECEIVED: "drgreen.payment_received",
    DRGREEN_PAYMENT_FAILED: "drgreen.payment_failed",
    DRGREEN_ORDER_CREATED: "drgreen.order_created",
    DRGREEN_ORDER_APPROVED: "drgreen.order_approved",
} as const;

/**
 * Get webhook event categories for UI
 */
export const WEBHOOK_EVENT_CATEGORIES = [
    {
        name: "Tenant Events",
        events: [
            { value: WEBHOOK_EVENTS.TENANT_CREATED, label: "Tenant Created" },
            { value: WEBHOOK_EVENTS.TENANT_UPDATED, label: "Tenant Updated" },
            { value: WEBHOOK_EVENTS.TENANT_ACTIVATED, label: "Tenant Activated" },
            { value: WEBHOOK_EVENTS.TENANT_DEACTIVATED, label: "Tenant Deactivated" },
        ],
    },
    {
        name: "Product Events",
        events: [
            { value: WEBHOOK_EVENTS.PRODUCT_CREATED, label: "Product Created" },
            { value: WEBHOOK_EVENTS.PRODUCT_UPDATED, label: "Product Updated" },
            { value: WEBHOOK_EVENTS.PRODUCT_DELETED, label: "Product Deleted" },
            { value: WEBHOOK_EVENTS.PRODUCT_LOW_STOCK, label: "Product Low Stock" },
            {
                value: WEBHOOK_EVENTS.PRODUCT_OUT_OF_STOCK,
                label: "Product Out of Stock",
            },
        ],
    },
    {
        name: "Order Events",
        events: [
            { value: WEBHOOK_EVENTS.ORDER_CREATED, label: "Order Created" },
            { value: WEBHOOK_EVENTS.ORDER_CONFIRMED, label: "Order Confirmed" },
            { value: WEBHOOK_EVENTS.ORDER_SHIPPED, label: "Order Shipped" },
            { value: WEBHOOK_EVENTS.ORDER_DELIVERED, label: "Order Delivered" },
            { value: WEBHOOK_EVENTS.ORDER_CANCELLED, label: "Order Cancelled" },
        ],
    },
    {
        name: "Consultation Events",
        events: [
            {
                value: WEBHOOK_EVENTS.CONSULTATION_SUBMITTED,
                label: "Consultation Submitted",
            },
            {
                value: WEBHOOK_EVENTS.CONSULTATION_APPROVED,
                label: "Consultation Approved",
            },
            {
                value: WEBHOOK_EVENTS.CONSULTATION_REJECTED,
                label: "Consultation Rejected",
            },
        ],
    },
];
