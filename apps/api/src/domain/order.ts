import { type CartLine, calculateSubtotal } from "./cart";
import { applyDiscount, type DiscountCode } from "./discount";

/** Everything the orders table needs, computed from the cart at checkout time. */
export type OrderDraft = {
  lines: CartLine[];
  discountCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

/**
 * Prices a cart for payment. Line prices are copied so the order keeps the
 * amounts the customer saw even if the catalog changes later.
 */
export function finalizeOrder(lines: CartLine[], discount: DiscountCode | null): OrderDraft {
  const snapshot = lines.map((line) => ({ ...line }));
  const subtotalCents = calculateSubtotal(snapshot, discount);
  const totalCents = applyDiscount(subtotalCents, discount);
  return {
    lines: snapshot,
    discountCode: discount?.code ?? null,
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
  };
}
