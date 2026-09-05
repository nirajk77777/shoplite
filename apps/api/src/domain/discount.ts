/**
 * A discount code as the pricing rules see it. `value` is a percentage for
 * `percent` codes and an amount in cents for `fixed` codes.
 */
export type DiscountCode = {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  /** The code only applies once the pre-discount amount reaches this. */
  minSubtotalCents: number;
  active: boolean;
};

/** The amount a discount takes off `amountCents`, in cents. Zero when it does not apply. */
export function discountAmount(amountCents: number, discount: DiscountCode | null): number {
  if (!discount?.active) return 0;
  if (amountCents < discount.minSubtotalCents) return 0;
  const off =
    discount.kind === "percent" ? Math.round((amountCents * discount.value) / 100) : discount.value;
  return Math.min(off, amountCents);
}

/** `amountCents` after the discount is taken off. Never below zero. */
export function applyDiscount(amountCents: number, discount: DiscountCode | null): number {
  return amountCents - discountAmount(amountCents, discount);
}
