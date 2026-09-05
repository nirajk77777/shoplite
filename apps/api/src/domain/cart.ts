import { applyDiscount, type DiscountCode, discountAmount } from "./discount";

/** One product in a cart, priced at the moment the line was added. */
export type CartLine = {
  productId: string;
  unitPriceCents: number;
  quantity: number;
};

/** What the storefront shows for a cart: the header badge and the cart page read these. */
export type CartTotals = {
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

export function lineTotal(line: CartLine): number {
  return line.unitPriceCents * line.quantity;
}

/**
 * The sum of every line. When a discount is passed, the subtotal is returned
 * with that discount already taken off, so callers rendering "subtotal" on a
 * discounted cart get the number the customer will pay.
 */
export function calculateSubtotal(lines: CartLine[], discount: DiscountCode | null = null): number {
  const gross = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return applyDiscount(gross, discount);
}

export function calculateCartTotals(lines: CartLine[], discount: DiscountCode | null): CartTotals {
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0);
  const subtotalCents = calculateSubtotal(lines);
  const discountCents = discountAmount(subtotalCents, discount);
  return {
    itemCount,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
