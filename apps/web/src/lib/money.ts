const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Prices come from the API in cents; the storefront shows dollars. */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
