import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { cartItems, carts, cartTotals, discountCodes, products } from "../db/schema";
import { type CartLine, type CartTotals, calculateCartTotals, lineTotal } from "../domain/cart";
import type { DiscountCode } from "../domain/discount";

export type OpenCart = { id: string; customerId: string; discountCode: string | null };

export type CartItemView = CartLine & {
  name: string;
  sku: string;
  lineTotalCents: number;
};

/** What the API returns for a cart. `totals` comes straight from the cart_totals row. */
export type CartView = OpenCart & {
  items: CartItemView[];
  totals: CartTotals;
};

/** The customer's open cart, created on first use together with its totals row. */
export async function openCartFor(db: Db, customerId: string): Promise<OpenCart> {
  const [existing] = await db
    .select({ id: carts.id, customerId: carts.customerId, discountCode: carts.discountCode })
    .from(carts)
    .where(and(eq(carts.customerId, customerId), eq(carts.status, "open")))
    .limit(1);
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(carts)
      .values({ customerId })
      .returning({ id: carts.id, customerId: carts.customerId, discountCode: carts.discountCode });
    if (!created) throw new Error("cart insert returned no row");
    await tx.insert(cartTotals).values({ cartId: created.id });
    return created;
  });
}

export async function loadCart(db: Db, cart: OpenCart): Promise<CartView> {
  const rows = await db
    .select({
      productId: cartItems.productId,
      unitPriceCents: cartItems.unitPriceCents,
      quantity: cartItems.quantity,
      name: products.name,
      sku: products.sku,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(cartItems.createdAt);

  const [totals] = await db
    .select({
      itemCount: cartTotals.itemCount,
      subtotalCents: cartTotals.subtotalCents,
      discountCents: cartTotals.discountCents,
      totalCents: cartTotals.totalCents,
    })
    .from(cartTotals)
    .where(eq(cartTotals.cartId, cart.id));

  return {
    ...cart,
    items: rows.map((row) => ({ ...row, lineTotalCents: lineTotal(row) })),
    totals: totals ?? { itemCount: 0, subtotalCents: 0, discountCents: 0, totalCents: 0 },
  };
}

export async function loadLines(db: Db, cartId: string): Promise<CartLine[]> {
  return db
    .select({
      productId: cartItems.productId,
      unitPriceCents: cartItems.unitPriceCents,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);
}

export async function loadDiscount(db: Db, code: string | null): Promise<DiscountCode | null> {
  if (!code) return null;
  const [row] = await db
    .select({
      code: discountCodes.code,
      kind: discountCodes.kind,
      value: discountCodes.value,
      minSubtotalCents: discountCodes.minSubtotalCents,
      active: discountCodes.active,
    })
    .from(discountCodes)
    .where(eq(discountCodes.code, code));
  return row ?? null;
}

/** Recomputes the cart_totals row from the current lines and discount. */
export async function refreshTotals(db: Db, cart: OpenCart): Promise<void> {
  const [lines, discount] = await Promise.all([
    loadLines(db, cart.id),
    loadDiscount(db, cart.discountCode),
  ]);
  const totals = calculateCartTotals(lines, discount);
  await db
    .insert(cartTotals)
    .values({ cartId: cart.id, ...totals })
    .onConflictDoUpdate({
      target: cartTotals.cartId,
      set: { ...totals, updatedAt: new Date() },
    });
}

export type AddItemResult = "ok" | "unknown_product";

/** Adds a product, or tops up its quantity if it is already in the cart. */
export async function addItem(
  db: Db,
  cart: OpenCart,
  productId: string,
  quantity: number,
): Promise<AddItemResult> {
  const [product] = await db
    .select({ id: products.id, priceCents: products.priceCents })
    .from(products)
    .where(eq(products.id, productId));
  if (!product) return "unknown_product";

  await db
    .insert(cartItems)
    .values({ cartId: cart.id, productId, unitPriceCents: product.priceCents, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
    });
  await refreshTotals(db, cart);
  return "ok";
}

/** Drops a product from the cart. */
export async function removeItem(db: Db, cart: OpenCart, productId: string): Promise<void> {
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)));
}

export type SetDiscountResult = "ok" | "invalid_code";

/** Attaches an active discount code to the cart. Unknown and inactive codes are refused. */
export async function setDiscount(
  db: Db,
  cart: OpenCart,
  code: string,
): Promise<SetDiscountResult> {
  const discount = await loadDiscount(db, code);
  if (!discount?.active) return "invalid_code";

  await db
    .update(carts)
    .set({ discountCode: code, updatedAt: new Date() })
    .where(eq(carts.id, cart.id));
  await refreshTotals(db, { ...cart, discountCode: code });
  return "ok";
}

export async function clearDiscount(db: Db, cart: OpenCart): Promise<void> {
  await db
    .update(carts)
    .set({ discountCode: null, updatedAt: new Date() })
    .where(eq(carts.id, cart.id));
  await refreshTotals(db, { ...cart, discountCode: null });
}
