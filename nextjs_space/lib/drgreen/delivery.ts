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
 * What Dr Green bills, in the order's own currency, when the market has no
 * Location.deliveryCharge set. Mirrors dr-green-backend
 * `CONSTANT.DELIVERY_CHARGE` (src/constants/constant.ts), which createOrder
 * falls back to (`checkCartValidity`). Not a BudStacks choice: it is shown
 * only because it is what the customer's card will be charged.
 */
export const DR_GREEN_DEFAULT_DELIVERY_CHARGE = 6;

/**
 * Dr Green's delivery charge for a market, read off a catalogue location
 * (`strainLocations[].location` on GET /dapp/strains).
 *
 * - a number ≥ 0 → that charge, in the location's currency;
 * - `null` → the market has none set, so Dr Green bills the default;
 * - field absent (backend without the field) or unusable → null: unknown, and
 *   checkout falls back to the server-cart quote or "Calculated by Dr Green".
 */
export function deliveryChargeFromLocation(location: unknown): number | null {
    if (!location || typeof location !== "object") return null;
    if (!("deliveryCharge" in location)) return null;
    const raw = (location as { deliveryCharge?: unknown }).deliveryCharge;
    if (raw === null) return DR_GREEN_DEFAULT_DELIVERY_CHARGE;
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return null;
    }
    return value;
}

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
