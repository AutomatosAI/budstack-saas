/**
 * Delivery charge handling for Dr Green orders.
 *
 * Dr Green owns this number. It is stored per market on Location.deliveryCharge
 * in that market's OWN currency, added to the amount PayCloud actually charges
 * (order total + delivery), and — since dr-green-backend #539 — locked onto the
 * order at creation and returned on the order-create response.
 *
 * BudStacks used to invent it: a hardcoded 5.0 shown to the customer and stored
 * as orders.shippingCost, while the customer's card was charged whatever Dr
 * Green resolved. In South Africa that is ~R110 once the $6→local backfill has
 * run, against R5 on screen — a shown-vs-charged gap of ~R105 per order
 * (US-011 / defect H in docs/prd/payment-decline-reduction.prd.md).
 */

/**
 * Last-resort display value, used only when Dr Green tells us nothing.
 *
 * Reachable while the backend change is not yet deployed to the environment
 * this store points at — the field is simply absent from the response, and the
 * old behaviour continues unchanged. It is NOT a correct charge for any market;
 * it exists so a missing field can never break checkout.
 */
export const FALLBACK_DELIVERY_CHARGE = 5.0;

/**
 * Read the authoritative delivery charge off a Dr Green order-create response.
 *
 * Returns the fallback when the field is absent (older backend) or unusable —
 * never NaN, never a negative charge, so the stored total is always coherent.
 */
export function deliveryChargeFromOrder(orderData: unknown): number {
    const raw = (orderData as { deliveryCharge?: unknown } | null | undefined)
        ?.deliveryCharge;
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return FALLBACK_DELIVERY_CHARGE;
    }
    return value;
}
