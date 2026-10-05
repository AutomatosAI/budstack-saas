import { describe, expect, it } from "vitest";
import type { CartItem } from "@/lib/cart-store";
import {
  basketSignature,
  basketSubtotal,
  livePriceOf,
  repriceBasket,
} from "@/lib/checkout/reprice-basket";

/**
 * BS-F01 (Dr Green Commission Flex readiness): the basket is in localStorage
 * with the price captured at add-to-cart, so checkout re-prices every line
 * from the tenant's live catalogue before the customer submits.
 */
function line(over: Partial<CartItem> = {}): CartItem {
  return {
    id: "s-1",
    productId: "s-1",
    name: "Strain One",
    price: 165,
    quantity: 5,
    currency: "R",
    ...over,
  };
}

const live = (over: Record<string, unknown> = {}) => ({
  id: "s-1",
  price: 165,
  currency: "R",
  isAvailable: true,
  in_stock: true,
  ...over,
});

describe("repriceBasket", () => {
  it("leaves a basket that already matches the catalogue untouched", () => {
    const items = [line()];
    const result = repriceBasket(items, [live()]);
    expect(result.changed).toBe(false);
    expect(result.priceChanged).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.items[0]).toBe(items[0]); // same object, no needless write
  });

  it("moves a stale line to the live price and reports it once", () => {
    const items = [line({ price: 165 })];
    const result = repriceBasket(items, [live({ price: 132 })]);
    expect(result.changed).toBe(true);
    expect(result.priceChanged).toEqual(["s-1"]);
    expect(result.items[0]).toMatchObject({ productId: "s-1", price: 132, quantity: 5 });
    // Re-pricing the updated basket finds nothing more to change.
    const again = repriceBasket(result.items, [live({ price: 132 })]);
    expect(again.changed).toBe(false);
    expect(again.priceChanged).toEqual([]);
  });

  it("never mutates the stored basket", () => {
    const items = [line({ price: 165 })];
    const snapshot = JSON.parse(JSON.stringify(items));
    repriceBasket(items, [live({ price: 99 })]);
    expect(items).toEqual(snapshot);
  });

  it("removes a product that is no longer listed", () => {
    const keep = line({ id: "s-2", productId: "s-2", name: "Kept" });
    const gone = line({ id: "s-9", productId: "s-9", name: "Gone" });
    const result = repriceBasket([gone, keep], [live({ id: "s-2" })]);
    expect(result.items.map((i) => i.productId)).toEqual(["s-2"]);
    expect(result.removed.map((i) => i.name)).toEqual(["Gone"]);
    expect(result.changed).toBe(true);
  });

  it("removes a listed product that can no longer be ordered", () => {
    const result = repriceBasket(
      [line(), line({ id: "s-2", productId: "s-2" })],
      [live(), live({ id: "s-2", isAvailable: false })],
    );
    expect(result.items.map((i) => i.productId)).toEqual(["s-1"]);
    expect(result.removed.map((i) => i.productId)).toEqual(["s-2"]);
  });

  it("ignores sub-cent float noise", () => {
    const result = repriceBasket([line({ price: 165 })], [live({ price: 165.001 })]);
    expect(result.changed).toBe(false);
  });

  it("takes the live currency with the live price", () => {
    const result = repriceBasket([line({ currency: "€" })], [live({ currency: "R" })]);
    expect(result.items[0].currency).toBe("R");
    expect(result.priceChanged).toEqual([]);
    expect(result.changed).toBe(true);
  });
});

describe("livePriceOf", () => {
  it("prefers the normalised price, then retailPrice, then 0 — like the product pages", () => {
    expect(livePriceOf({ id: "a", price: 132, retailPrice: 10 })).toBe(132);
    expect(livePriceOf({ id: "a", retailPrice: 10 })).toBe(10);
    expect(livePriceOf({ id: "a" })).toBe(0);
  });
});

describe("basketSubtotal / basketSignature", () => {
  it("sums price × grams", () => {
    expect(
      basketSubtotal([line({ price: 132, quantity: 5 }), line({ productId: "s-2", price: 100, quantity: 2 })]),
    ).toBe(860);
  });

  it("changes with contents but not with price, so writing a live price back does not refetch", () => {
    const a = basketSignature([line({ price: 165 })]);
    expect(basketSignature([line({ price: 132 })])).toBe(a);
    expect(basketSignature([line({ quantity: 10 })])).not.toBe(a);
    expect(basketSignature([])).toBe("");
  });
});
