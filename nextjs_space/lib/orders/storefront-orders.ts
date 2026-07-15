import { prisma } from "@/lib/db";
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { logger } from "@/lib/logger";
import type { StorefrontOrder } from "./order-presentation";

// Re-export the pure types so server callers can import them from here too.
export type { StorefrontOrder, StorefrontOrderItem } from "./order-presentation";

/**
 * Storefront order helpers — list a customer's orders and pull live status from
 * Dr Green so the dashboard / orders page reflect a payment or fulfilment update
 * the moment the customer opens the page (not only when the webhook lands).
 */

export interface DrGreenStorefrontConfig {
  apiKey: string;
  secretKey: string;
  apiUrl?: string;
}

// Orders settled on both axes never need re-polling.
const TERMINAL_ORDER_STATUSES = new Set(["DELIVERED", "CANCELLED"]);
const TERMINAL_PAYMENT_STATUSES = new Set([
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
]);
// Dr Green payment / fulfilment values we trust to write onto our columns.
const SYNCABLE_PAYMENT = new Set([
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);
const SYNCABLE_FULFILMENT = new Set([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
// Cap fan-out so a long history never triggers dozens of Dr Green calls.
const MAX_SYNC = 12;

const ORDER_INCLUDE = { order_items: true } as const;

type OrderRow = {
  id: string;
  orderNumber: string;
  total: number | null;
  subtotal: number | null;
  shippingCost: number | null;
  status: string;
  paymentStatus: string;
  drGreenOrderId: string | null;
  drGreenInvoiceNum: string | null;
  createdAt: Date;
  order_items: {
    id: string;
    productName: string;
    quantity: number;
    price: number | null;
  }[];
};

/**
 * Pull one order's live status from Dr Green and persist any change. Best-effort
 * — never throws — so a Dr Green hiccup leaves the cached row untouched. Mirrors
 * getOrder()'s payment sync and additionally tracks fulfilment (orderStatus).
 */
async function syncOneOrder(
  order: {
    id: string;
    drGreenOrderId: string;
    paymentStatus: string;
    status: string;
    drGreenInvoiceNum: string | null;
  },
  config: DrGreenStorefrontConfig,
): Promise<void> {
  try {
    const res = await callDrGreenAPI<any>(`/dapp/orders/${order.drGreenOrderId}`, {
      method: "GET",
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      baseUrl: config.apiUrl,
      // GET with a path param → DualAuthGuard signs JSON.stringify(req.params).
      signBody: { orderId: order.drGreenOrderId },
    });
    const details =
      res?.data?.orderDetails ?? res?.orderDetails ?? res?.data ?? res ?? {};

    const data: {
      paymentStatus?: string;
      status?: string;
      drGreenInvoiceNum?: string;
    } = {};

    const pay =
      typeof details?.paymentStatus === "string"
        ? details.paymentStatus.toUpperCase()
        : null;
    if (pay && pay !== order.paymentStatus && SYNCABLE_PAYMENT.has(pay)) {
      data.paymentStatus = pay;
    }

    const ful =
      typeof details?.orderStatus === "string"
        ? details.orderStatus.toUpperCase()
        : null;
    if (ful && ful !== order.status && SYNCABLE_FULFILMENT.has(ful)) {
      data.status = ful;
    }

    // Order number: Dr Green is the source of truth. It (re)writes the order's
    // invoiceNumber at each PayCloud checkout mint, so mirror the current value
    // — this is the number Dr Green admin and the customer emails display.
    const inv =
      typeof details?.invoiceNumber === "string" && details.invoiceNumber.trim()
        ? details.invoiceNumber.trim()
        : null;
    if (inv && inv !== order.drGreenInvoiceNum) {
      data.drGreenInvoiceNum = inv;
    }

    if (Object.keys(data).length > 0) {
      await prisma.orders.update({ where: { id: order.id }, data });
    }
  } catch (err) {
    logger.warn(`[orders] sync failed for ${order.id}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function toStorefrontOrder(o: OrderRow): StorefrontOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    total: o.total ?? 0,
    subtotal: o.subtotal ?? 0,
    shippingCost: o.shippingCost ?? 0,
    status: o.status,
    paymentStatus: o.paymentStatus,
    drGreenOrderId: o.drGreenOrderId,
    drGreenInvoiceNum: o.drGreenInvoiceNum,
    createdAt: o.createdAt.toISOString(),
    items: (o.order_items ?? []).map((it) => ({
      id: it.id,
      productName: it.productName,
      quantity: it.quantity,
      price: it.price ?? 0,
    })),
  };
}

/**
 * List a user's orders (newest first) for a tenant, syncing live status from Dr
 * Green for any not-yet-settled order before returning.
 */
export async function listUserOrdersWithSync(params: {
  userId: string;
  tenantId: string;
  config: DrGreenStorefrontConfig;
  limit?: number;
}): Promise<StorefrontOrder[]> {
  const { userId, tenantId, config, limit } = params;
  const query = {
    where: { userId, tenantId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" as const },
    ...(limit ? { take: limit } : {}),
  };

  const rows = (await prisma.orders.findMany(query)) as unknown as OrderRow[];

  const toSync = rows
    .filter(
      (o) =>
        o.drGreenOrderId &&
        (!TERMINAL_ORDER_STATUSES.has(o.status) ||
          !TERMINAL_PAYMENT_STATUSES.has(o.paymentStatus)),
    )
    .slice(0, MAX_SYNC);

  if (toSync.length === 0) return rows.map(toStorefrontOrder);

  await Promise.allSettled(
    toSync.map((o) =>
      syncOneOrder(
        {
          id: o.id,
          drGreenOrderId: o.drGreenOrderId as string,
          paymentStatus: o.paymentStatus,
          status: o.status,
          drGreenInvoiceNum: o.drGreenInvoiceNum,
        },
        config,
      ),
    ),
  );

  // Re-read so the response reflects synced changes.
  const fresh = (await prisma.orders.findMany(query)) as unknown as OrderRow[];
  return fresh.map(toStorefrontOrder);
}

/**
 * Refresh a single order from Dr Green by our local id. Used right after a
 * PayCloud checkout is minted (order submit + retry) so we capture the current
 * Dr Green invoiceNumber — which the mint (re)writes — instead of the pre-mint
 * value stored at creation. Best-effort: never throws.
 */
export async function syncOrderById(
  localOrderId: string,
  config: DrGreenStorefrontConfig,
): Promise<void> {
  const o = await prisma.orders.findUnique({
    where: { id: localOrderId },
    select: {
      id: true,
      drGreenOrderId: true,
      paymentStatus: true,
      status: true,
      drGreenInvoiceNum: true,
    },
  });
  if (!o?.drGreenOrderId) return;
  await syncOneOrder(
    {
      id: o.id,
      drGreenOrderId: o.drGreenOrderId,
      paymentStatus: o.paymentStatus,
      status: o.status,
      drGreenInvoiceNum: o.drGreenInvoiceNum,
    },
    config,
  );
}
