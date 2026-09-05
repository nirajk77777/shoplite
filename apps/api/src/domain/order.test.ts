import { describe, expect, it } from "vitest";
import type { CartLine } from "./cart";
import { finalizeOrder } from "./order";

const mug: CartLine = { productId: "mug", unitPriceCents: 1200, quantity: 2 };
const poster: CartLine = { productId: "poster", unitPriceCents: 2599, quantity: 1 };

describe("finalizeOrder", () => {
  it("charges the subtotal when no discount code is attached", () => {
    const order = finalizeOrder([mug, poster], null);

    expect(order.subtotalCents).toBe(4999);
    expect(order.discountCents).toBe(0);
    expect(order.totalCents).toBe(4999);
    expect(order.discountCode).toBeNull();
  });

  it("snapshots the lines so later price changes do not alter the order", () => {
    const line = { ...mug };
    const order = finalizeOrder([line], null);
    line.unitPriceCents = 1;

    expect(order.lines).toEqual([{ productId: "mug", unitPriceCents: 1200, quantity: 2 }]);
  });

  it("records which code was used", () => {
    const order = finalizeOrder([mug], {
      code: "SALE10",
      kind: "percent",
      value: 10,
      minSubtotalCents: 0,
      active: true,
    });

    expect(order.discountCode).toBe("SALE10");
  });
});
