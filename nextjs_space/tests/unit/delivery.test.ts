import { describe, expect, it } from "vitest";
import {
  FALLBACK_DELIVERY_CHARGE,
  deliveryChargeFromOrder,
} from "@/lib/drgreen/delivery";

// PRD payment-decline-reduction US-011 / defect H: BudStacks used to display a
// hardcoded 5.0 shipping line while PayCloud charged Dr Green's real per-market
// rate (~R110 in ZA once the $6→local backfill has run). The charge is Dr
// Green's to decide, so it is read off the order-create response — but a
// missing or malformed field must never break checkout.
describe("deliveryChargeFromOrder", () => {
  it("uses the charge Dr Green put on the order", () => {
    expect(deliveryChargeFromOrder({ deliveryCharge: 110 })).toBe(110);
  });

  it("accepts a legitimate zero — free delivery is a real setting", () => {
    expect(deliveryChargeFromOrder({ deliveryCharge: 0 })).toBe(0);
  });

  it("coerces a numeric string", () => {
    expect(deliveryChargeFromOrder({ deliveryCharge: "110.5" })).toBe(110.5);
  });

  it.each([
    ["field absent (backend predates #539)", { id: "order_1" }],
    ["explicit null", { deliveryCharge: null }],
    ["not a number", { deliveryCharge: "free" }],
    ["negative", { deliveryCharge: -1 }],
    ["no order at all", null],
    ["undefined", undefined],
  ])("falls back on %s", (_label, input) => {
    expect(deliveryChargeFromOrder(input)).toBe(FALLBACK_DELIVERY_CHARGE);
  });
});
