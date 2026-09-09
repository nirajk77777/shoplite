import { type CartLine, calculateSubtotal, lineTotal } from "./cart";
import { applyDiscount, type DiscountCode } from "./discount";

/** Everything the orders table needs, computed from the cart at checkout time. */
export type OrderDraft = {
  lines: CartLine[];
  discountCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** How the charge reads on the customer's card statement. */
  description: string;
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
    description: statementDescriptor(snapshot),
  };
}

/**
 * How the charge reads on the customer's statement. A statement line has room for
 * one product, and the one a customer recognises is the one they spent the most
 * on, so the order is named after that line and counts the rest.
 */
export function statementDescriptor(lines: CartLine[]): string {
  if (lines.length === 0) return "SHOPLITE";

  const headline = lines.reduce((most, line) => (lineTotal(line) > lineTotal(most) ? line : most));
  const others = lines.length - 1;
  return others === 0
    ? `SHOPLITE ${headline.productId}`
    : `SHOPLITE ${headline.productId} +${others}`;
}