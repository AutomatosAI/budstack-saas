/**
 * Price local order rows from Dr Green, never from the browser (BS-F02).
 *
 * Dr Green is the system of record for what an order costs. What it returns:
 *
 * - POST /dapp/orders → `data` is the created Order row: `totalAmount` (line
 *   items only, in the order's own currency), `deliveryCharge` (billed on top,
 *   same currency, null on pre-#539 backends), `currency`. No order lines.
 * - GET /dapp/orders/:id → `data.orderDetails`. Each `orderLines[]` entry has
 *   `quantity`, `strain.id` and `localPrice.productAmount`, the LINE total in
 *   local currency (quantity × unit). `orderDetails.localPrice.totalAmount` is
 *   the local line-items total. `orderDetails.totalAmount` is NOT the stored
 *   value: the reader overwrites it with the sum of strain BASE prices (USD),
 *   so it must never be mirrored into a local-currency column.
 *   `orderDetails.deliveryCharge` is the stored, locked value.
 *
 * Until Dr Green's order-line price snapshot (US-P01..P03) ships, the GET
 * reader prices lines from the CURRENT catalogue, so its numbers can drift
 * from what was charged if a price moves after the order. At creation time
 * they agree, which is when BudStacks reads them.
 */
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";
import { logger } from "@/lib/logger";

/** Money comparisons: under half a cent is the same amount. */
const MONEY_EPSILON = 0.005;

/** A non-negative finite amount, coercing numeric strings; else null. */
export function moneyOrNull(raw: unknown): number | null {
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

function differs(a: number, b: number): boolean {
    return Math.abs(a - b) >= MONEY_EPSILON;
}

/** The order-create response's line-items total (local currency). */
export function subtotalFromCreatedOrder(orderData: unknown): number | null {
    return moneyOrNull((orderData as { totalAmount?: unknown } | null)?.totalAmount);
}

/** `orderDetails` out of a GET /dapp/orders/:id response (single or raw). */
export function orderDetailsOf(response: unknown): any | null {
    const res = response as { data?: { orderDetails?: unknown }; orderDetails?: unknown } | null;
    return res?.data?.orderDetails ?? res?.orderDetails ?? null;
}

/**
 * Unit price per strain from Dr Green order lines. `localPrice.productAmount`
 * is the line total, so the unit price is productAmount ÷ quantity.
 */
export function unitPricesFromOrderLines(lines: unknown): Map<string, number> {
    const prices = new Map<string, number>();
    if (!Array.isArray(lines)) return prices;
    for (const line of lines) {
        const strainId = line?.strain?.id ?? line?.strainId;
        const quantity = Number(line?.quantity);
        const amount = moneyOrNull(line?.localPrice?.productAmount);
        if (typeof strainId === "string" && quantity > 0 && amount !== null) {
            prices.set(strainId, amount / quantity);
        }
    }
    return prices;
}

export interface OrderLineInput {
    strainId: string;
    quantity: number;
    name: string;
    /** What the browser showed. Compared and logged, never stored. */
    clientPrice: number | null;
}

export type LinePriceSource = "drgreen" | "catalogue" | "allocated";

export interface PricedOrderLine {
    strainId: string;
    quantity: number;
    name: string;
    /** Unit price (per gram), the value written to order_items.price. */
    price: number;
    source: LinePriceSource;
}

export interface PriceMismatch {
    strainId: string;
    clientPrice: number;
    price: number;
    source: LinePriceSource;
}

export interface OrderPricing {
    lines: PricedOrderLine[];
    /** Dr Green's line-items total when it gave one, else the lines' sum. */
    subtotal: number;
    mismatches: PriceMismatch[];
    /** The priced lines do not add up to Dr Green's total. */
    linesDisagreeWithTotal: boolean;
}

/**
 * Price each line: Dr Green's order line → the server-fetched live catalogue
 * → an even per-gram share of whatever part of Dr Green's total the priced
 * lines do not account for. The browser's price is never a source.
 *
 * Catalogue prices are a fallback, and can be FX-converted from the EUR base
 * (normalizeProduct priority 3) rather than what Dr Green charged. When they
 * do not reconcile with Dr Green's total, they are discarded and those lines
 * take the per-gram share instead, so the lines always add up to what Dr
 * Green stored whenever that is possible.
 */
export function priceOrderLines(params: {
    items: readonly OrderLineInput[];
    drGreenUnitPrices: ReadonlyMap<string, number>;
    catalogueUnitPrices?: Readonly<Record<string, number>>;
    drGreenSubtotal: number | null;
}): OrderPricing {
    const { items, drGreenUnitPrices, catalogueUnitPrices, drGreenSubtotal } = params;

    const withCatalogue = priceLines(items, drGreenUnitPrices, catalogueUnitPrices, drGreenSubtotal);
    const usedCatalogue = withCatalogue.lines.some((l) => l.source === "catalogue");
    const lines =
        usedCatalogue && withCatalogue.disagrees
            ? pickReconciling(withCatalogue, priceLines(items, drGreenUnitPrices, undefined, drGreenSubtotal))
            : withCatalogue;

    const mismatches: PriceMismatch[] = lines.lines.flatMap((line, i) => {
        const clientPrice = items[i].clientPrice;
        return clientPrice !== null && differs(clientPrice, line.price)
            ? [{ strainId: line.strainId, clientPrice, price: line.price, source: line.source }]
            : [];
    });

    return {
        lines: lines.lines,
        subtotal: drGreenSubtotal ?? lines.total,
        mismatches,
        linesDisagreeWithTotal: lines.disagrees,
    };
}

interface LinePricing {
    lines: PricedOrderLine[];
    total: number;
    disagrees: boolean;
}

function pickReconciling(preferred: LinePricing, alternative: LinePricing): LinePricing {
    return alternative.disagrees ? preferred : alternative;
}

function priceLines(
    items: readonly OrderLineInput[],
    drGreenUnitPrices: ReadonlyMap<string, number>,
    catalogueUnitPrices: Readonly<Record<string, number>> | undefined,
    drGreenSubtotal: number | null,
): LinePricing {
    const resolved = items.map((item) => {
        const fromOrder = drGreenUnitPrices.get(item.strainId);
        if (fromOrder !== undefined) return { item, price: fromOrder, source: "drgreen" as const };
        const fromCatalogue = moneyOrNull(catalogueUnitPrices?.[item.strainId]);
        if (fromCatalogue !== null && fromCatalogue > 0) {
            return { item, price: fromCatalogue, source: "catalogue" as const };
        }
        return { item, price: null, source: "allocated" as const };
    });

    const knownTotal = resolved.reduce((sum, r) => sum + (r.price ?? 0) * r.item.quantity, 0);
    const unknownGrams = resolved.reduce(
        (sum, r) => sum + (r.price === null ? r.item.quantity : 0),
        0,
    );
    const remaining = Math.max(0, (drGreenSubtotal ?? knownTotal) - knownTotal);
    const allocatedUnit = unknownGrams > 0 ? remaining / unknownGrams : 0;

    const lines: PricedOrderLine[] = resolved.map((r) => ({
        strainId: r.item.strainId,
        quantity: r.item.quantity,
        name: r.item.name,
        price: r.price ?? allocatedUnit,
        source: r.source,
    }));
    const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return {
        lines,
        total,
        disagrees: drGreenSubtotal !== null && differs(total, drGreenSubtotal),
    };
}

/**
 * Price a just-created Dr Green order. Reads lines off the create response
 * when it carries them, else GET /dapp/orders/:id. Never throws — the Dr Green
 * order already exists, so a failed read must not fail the checkout; it falls
 * back to the server-side catalogue and is logged.
 */
export async function resolveOrderPricing(params: {
    orderData: any;
    items: readonly OrderLineInput[];
    catalogueUnitPrices?: Readonly<Record<string, number>>;
    apiKey: string;
    secretKey: string;
    apiUrl?: string;
    requestId?: string;
}): Promise<OrderPricing> {
    const { orderData, items, catalogueUnitPrices, apiKey, secretKey, apiUrl, requestId } = params;
    const drGreenOrderId: string = orderData.id;

    let drGreenUnitPrices = unitPricesFromOrderLines(orderData?.orderLines);
    const coversAll = items.every((i) => drGreenUnitPrices.has(i.strainId));
    if (!coversAll) {
        try {
            const res = await callDrGreenAPI<unknown>(`/dapp/orders/${drGreenOrderId}`, {
                method: "GET",
                apiKey,
                secretKey,
                baseUrl: apiUrl,
                // GET with a path param → DualAuthGuard signs JSON.stringify(req.params).
                signBody: { orderId: drGreenOrderId },
            });
            drGreenUnitPrices = unitPricesFromOrderLines(orderDetailsOf(res)?.orderLines);
        } catch (err) {
            logger.warn("[orders] could not read Dr Green order lines; pricing from the live catalogue", {
                requestId,
                drGreenOrderId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    const pricing = priceOrderLines({
        items,
        drGreenUnitPrices,
        catalogueUnitPrices,
        drGreenSubtotal: subtotalFromCreatedOrder(orderData),
    });

    if (pricing.mismatches.length > 0) {
        // Dr Green wins. A difference here means the customer saw a different
        // price than Dr Green charged — a stale basket or a price move.
        logger.warn("[orders] browser price differs from Dr Green price; Dr Green wins", {
            requestId,
            drGreenOrderId,
            mismatches: pricing.mismatches,
        });
    }
    if (pricing.linesDisagreeWithTotal) {
        logger.warn("[orders] order lines do not add up to Dr Green's total", {
            requestId,
            drGreenOrderId,
            subtotal: pricing.subtotal,
            sources: pricing.lines.map((l) => l.source),
        });
    }
    return pricing;
}

// ── Sync (syncOneOrder) ─────────────────────────────────────────────────────

export interface OrderTotals {
    subtotal: number | null;
    shippingCost: number | null;
    total: number | null;
}

/**
 * Totals from GET /dapp/orders/:id `orderDetails`: the LOCAL line-items total
 * (`localPrice.totalAmount`, not the overwritten USD `totalAmount`) and the
 * stored `deliveryCharge` (null on orders placed before it was locked).
 */
export function totalsFromOrderDetails(details: unknown): {
    subtotal: number | null;
    deliveryCharge: number | null;
} {
    const d = details as { localPrice?: { totalAmount?: unknown }; deliveryCharge?: unknown } | null;
    return {
        subtotal: moneyOrNull(d?.localPrice?.totalAmount),
        deliveryCharge: moneyOrNull(d?.deliveryCharge),
    };
}

/**
 * The column changes that make a local row carry Dr Green's totals. A field
 * Dr Green did not report keeps the local value. Only differences are
 * returned, so an in-step row produces no write.
 */
export function planTotalsUpdate(
    current: OrderTotals,
    fromDrGreen: { subtotal: number | null; deliveryCharge: number | null },
): Partial<{ subtotal: number; shippingCost: number; total: number }> {
    const subtotal = fromDrGreen.subtotal ?? current.subtotal;
    const shippingCost = fromDrGreen.deliveryCharge ?? current.shippingCost;
    if (subtotal === null || shippingCost === null) return {};
    const total = subtotal + shippingCost;

    const update: Partial<{ subtotal: number; shippingCost: number; total: number }> = {};
    if (current.subtotal === null || differs(subtotal, current.subtotal)) update.subtotal = subtotal;
    if (current.shippingCost === null || differs(shippingCost, current.shippingCost)) {
        update.shippingCost = shippingCost;
    }
    if (current.total === null || differs(total, current.total)) update.total = total;
    return update;
}
