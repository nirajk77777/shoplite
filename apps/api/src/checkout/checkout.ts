import { desc, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { loadDiscount, loadLines, type OpenCart, openCartFor } from "../carts/cart-store";
import type { Db } from "../db/client";
import { carts, orders, payments } from "../db/schema";
import { finalizeOrder, type OrderDraft } from "../domain/order";
import { cardLast4, type PaymentGateway } from "../payments/mock-gateway";
import { checkoutAttempts, recordCheckoutError } from "../telemetry/metrics";

export type Card = { number: string; expMonth: number; expYear: number };

export type Order = typeof orders.$inferSelect;

export type CheckoutResult =
  | { status: "paid"; order: Order }
  | { status: "declined" }
  | { status: "empty_cart" };

/**
 * Prices the open cart, charges the card, and on approval writes the order and
 * closes the cart. A decline is recorded on the payments table and logged with
 * the gateway's reason; the caller decides what the customer gets to see.
 */
export async function checkout(
  db: Db,
  gateway: PaymentGateway,
  log: FastifyBaseLogger,
  input: { customerId: string; card: Card },
): Promise<CheckoutResult> {
  checkoutAttempts.add(1);
  try {
    return await runCheckout(db, gateway, log, input);
  } catch (error) {
    recordCheckoutError("error");
    throw error;
  }
}

async function runCheckout(
  db: Db,
  gateway: PaymentGateway,
  log: FastifyBaseLogger,
  input: { customerId: string; card: Card },
): Promise<CheckoutResult> {
  const cart = await openCartFor(db, input.customerId);
  const lines = await loadLines(db, cart.id);
  const discount = await loadDiscount(db, cart.discountCode);
  const draft = finalizeOrder(lines, discount);
  if (draft.lines.length === 0) {
    recordCheckoutError("empty_cart");
    return { status: "empty_cart" };
  }

  const last4 = cardLast4(input.card.number);

  const charge = await gateway.charge({
    amountCents: draft.totalCents,
    currency: "USD",
    cardNumber: input.card.number,
    expMonth: input.card.expMonth,
    expYear: input.card.expYear,
    description: draft.description,
  });

  if (charge.status === "declined") {
    await db.insert(payments).values({
      customerId: input.customerId,
      cartId: cart.id,
      amountCents: draft.totalCents,
      cardLast4: last4,
      status: "declined",
      declineCode: charge.declineCode,
      declineMessage: charge.message,
    });
    log.warn(
      {
        customerId: input.customerId,
        cartId: cart.id,
        amountCents: draft.totalCents,
        cardLast4: last4,
        description: draft.description,
        declineCode: charge.declineCode,
        declineMessage: charge.message,
      },
      `payment declined by gateway: ${charge.declineCode}`,
    );
    recordCheckoutError("declined");
    return { status: "declined" };
  }

  const order = await writeOrder(db, cart, draft, last4, charge.reference);
  log.info(
    {
      customerId: input.customerId,
      orderId: order.id,
      totalCents: order.totalCents,
      discountCode: order.discountCode,
    },
    "checkout completed",
  );
  return { status: "paid", order };
}

/** The customer's orders, newest first. */
export async function listOrdersFor(db: Db, customerId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
}

async function writeOrder(
  db: Db,
  cart: OpenCart,
  draft: OrderDraft,
  last4: string,
  gatewayReference: string,
): Promise<Order> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        customerId: cart.customerId,
        cartId: cart.id,
        discountCode: draft.discountCode,
        subtotalCents: draft.subtotalCents,
        discountCents: draft.discountCents,
        totalCents: draft.totalCents,
        lines: draft.lines,
      })
      .returning();
    if (!order) throw new Error("order insert returned no row");

    await tx.insert(payments).values({
      customerId: cart.customerId,
      cartId: cart.id,
      orderId: order.id,
      amountCents: draft.totalCents,
      cardLast4: last4,
      status: "approved",
      gatewayReference,
    });
    await tx
      .update(carts)
      .set({ status: "checked_out", updatedAt: new Date() })
      .where(eq(carts.id, cart.id));
    return order;
  });
}
