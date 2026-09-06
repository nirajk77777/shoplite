import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { CartTotals } from "../api/client";
import { pluralItems } from "../lib/items";
import { formatCents } from "../lib/money";

/**
 * The hang-tag in the header. It shows the count and total the API reads from
 * the cart_totals row, never a sum of the lines, so a stale row shows here.
 */
export function CartTag({ totals, version }: { totals: CartTotals | null; version: number }) {
  const [swinging, setSwinging] = useState(false);

  useEffect(() => {
    if (version === 0) return;
    setSwinging(true);
    const timer = setTimeout(() => setSwinging(false), 700);
    return () => clearTimeout(timer);
  }, [version]);

  const label = pluralItems(totals?.itemCount ?? 0);

  return (
    <Link to="/cart" className={`tag${swinging ? " tag--swing" : ""}`}>
      <span className="tag__hole" aria-hidden="true" />
      <span className="sr-only">Cart</span>
      <span className="tag__count">{label}</span>
      <span className="tag__total">{formatCents(totals?.totalCents ?? 0)}</span>
    </Link>
  );
}
