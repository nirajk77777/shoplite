import { describe, expect, it } from "vitest";
import { type CartLine, calculateCartTotals, calculateSubtotal, lineTotal } from "./cart";
import type { DiscountCode } from "./discount";

const mug: CartLine = { productId: "mug", unitPriceCents: 1200, quantity: 2 };
const poster: CartLine = { productId: "poster", unitPriceCents: 2599, quantity: 1 };

const sale10: DiscountCode = {
  code: "SALE10",
  kind: "percent",
  value: 10,
  minSubtotalCents: 0,
  active: true,
};

describe("lineTotal", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotal(mug)).toBe(2400);
  });
});

describe("calculateSubtotal", () => {
  it("sums the line totals", () => {
    expect(calculateSubtotal([mug, poster])).toBe(4999);
  });

  it("is zero for an empty cart", () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

describe("calculateCartTotals", () => {
  it("reports count, subtotal, discount, and total for a cart with a code", () => {
    expect(calculateCartTotals([mug, poster], sale10)).toEqual({
      itemCount: 3,
      subtotalCents: 4999,
      discountCents: 500,
      totalCents: 4499,
    });
  });

  it("has no discount line without a code", () => {
    expect(calculateCartTotals([mug, poster], null)).toEqual({
      itemCount: 3,
      subtotalCents: 4999,
      discountCents: 0,
      totalCents: 4999,
    });
  });
});
