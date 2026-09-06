import type { CartTotals } from "../api/client";
import { formatCents } from "../lib/money";

type ReceiptProps = {
  totals: CartTotals;
  discountCode?: string | null;
  /** Whatever belongs below the total: the pay button, a link to checkout. */
  footer?: React.ReactNode;
};

/** Totals set like a till receipt, so subtotal, discount, and total read as money. */
export function Receipt({ totals, discountCode, footer }: ReceiptProps) {
  return (
    <div className="receipt">
      <dl className="receipt__lines">
        <div className="receipt__row">
          <dt>Subtotal</dt>
          <dd>{formatCents(totals.subtotalCents)}</dd>
        </div>
        {(totals.discountCents > 0 || discountCode) && (
          <div className="receipt__row">
            <dt>Discount{discountCode ? ` · ${discountCode}` : ""}</dt>
            <dd>{formatCents(-totals.discountCents)}</dd>
          </div>
        )}
        <div className="receipt__row receipt__row--total">
          <dt>Total</dt>
          <dd>{formatCents(totals.totalCents)}</dd>
        </div>
      </dl>
      {footer && <div className="receipt__footer">{footer}</div>}
    </div>
  );
}
