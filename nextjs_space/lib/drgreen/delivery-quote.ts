/**
 * Delivery quote for checkout (BS-F01) — read off Dr Green's server cart.
 *
 * Dr Green exposes the charge it will bill on top of the order total as
 * `localPrices.deliveryCharge` on each cart in GET /dapp/carts (added with
 * dr-green-backend US-011 / defect H). The catalogue does not carry it and
 * there is no per-market delivery endpoint, so the server cart is the only
 * place a storefront can read it before the order exists. When the customer
 * has no server cart (the common case: BudStacks keeps the basket in the
 * browser and only pushes it to Dr Green at submit), there is no quote and
 * checkout says delivery is calculated by Dr Green.
 *
 * GET /dapp/carts lists EVERY client of the calling key that has a non-empty
 * cart, newest first, ten per page. It does not filter by `clientId`
 * (GetCartsDto has only `search`; the whitelist strips anything else), so the
 * customer's own cart must be picked out by id — reading `clients[0]` returns
 * whichever customer of the store touched a cart last.
 */
import { callDrGreenAPI } from "@/lib/drgreen/drgreen-api-client";

export interface DeliveryQuote {
    /** In the market's own currency, billed on top of the line items. */
    deliveryCharge: number;
    /** ISO code Dr Green reported for the cart, when it reported one. */
    currency: string | null;
}

/** The given client's cart out of a GET /dapp/carts response, or null. */
export function pickClientCart(response: unknown, clientId: string): any | null {
    const body = response as { data?: { clients?: unknown }; clients?: unknown } | null;
    const clients = body?.data?.clients ?? body?.clients;
    if (!Array.isArray(clients) || !clientId) return null;
    const mine = clients.find((c: any) => c?.id === clientId);
    const cart = mine?.clientCart?.[0];
    return cart ?? null;
}

/** The delivery quote on a Dr Green cart, or null when it carries none. */
export function deliveryQuoteFromCart(cart: unknown): DeliveryQuote | null {
    const localPrices = (cart as { localPrices?: Record<string, unknown> } | null)
        ?.localPrices;
    const raw = localPrices?.deliveryCharge;
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return null;
    }
    const currency = localPrices?.currency;
    return {
        deliveryCharge: value,
        currency: typeof currency === "string" && currency ? currency : null,
    };
}

/**
 * Fetch the customer's delivery quote. `search` narrows Dr Green's list to the
 * customer's email (it matches name or email, case-insensitive) so their cart
 * is on the first page; the id match then makes the pick exact.
 */
export async function fetchDeliveryQuote(params: {
    clientId: string;
    email: string;
    apiKey: string;
    secretKey: string;
    apiUrl?: string;
}): Promise<DeliveryQuote | null> {
    const { clientId, email, apiKey, secretKey, apiUrl } = params;
    const response = await callDrGreenAPI<unknown>("/dapp/carts", {
        method: "GET",
        apiKey,
        secretKey,
        baseUrl: apiUrl,
        queryParams: { search: email },
    });
    return deliveryQuoteFromCart(pickClientCart(response, clientId));
}
