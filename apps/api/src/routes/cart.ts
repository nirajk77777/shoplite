import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app";
import {
  addItem,
  clearDiscount,
  loadCart,
  openCartFor,
  removeItem,
  setDiscount,
} from "../carts/cart-store";
import { parseBody } from "../http/body";
import { type CustomerParams, requireCustomer } from "../http/customer-param";

const addItemBody = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(99).default(1),
});

const discountBody = z.object({ code: z.string().trim().min(1).max(32) });

type ItemParams = CustomerParams & { productId: string };

export async function cartRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  app.get<{ Params: CustomerParams }>("/customers/:customerId/cart", async (request, reply) => {
    const customer = await requireCustomer(db, request, reply);
    if (!customer) return;
    return loadCart(db, await openCartFor(db, customer.id));
  });

  app.post<{ Params: CustomerParams }>(
    "/customers/:customerId/cart/items",
    async (request, reply) => {
      const customer = await requireCustomer(db, request, reply);
      if (!customer) return;
      const body = await parseBody(addItemBody, request.body, reply);
      if (!body) return;

      const cart = await openCartFor(db, customer.id);
      const result = await addItem(db, cart, body.productId, body.quantity);
      if (result === "unknown_product") {
        return reply.code(404).send({ error: "Product not found" });
      }
      return loadCart(db, cart);
    },
  );

  app.delete<{ Params: ItemParams }>(
    "/customers/:customerId/cart/items/:productId",
    async (request, reply) => {
      const customer = await requireCustomer(db, request, reply);
      if (!customer) return;

      const cart = await openCartFor(db, customer.id);
      await removeItem(db, cart, request.params.productId);
      return loadCart(db, cart);
    },
  );

  app.post<{ Params: CustomerParams }>(
    "/customers/:customerId/cart/discount",
    async (request, reply) => {
      const customer = await requireCustomer(db, request, reply);
      if (!customer) return;
      const body = await parseBody(discountBody, request.body, reply);
      if (!body) return;

      const cart = await openCartFor(db, customer.id);
      const code = body.code.toUpperCase();
      const result = await setDiscount(db, cart, code);
      if (result === "invalid_code") {
        return reply.code(400).send({ error: "Discount code is not valid" });
      }
      return loadCart(db, { ...cart, discountCode: code });
    },
  );

  app.delete<{ Params: CustomerParams }>(
    "/customers/:customerId/cart/discount",
    async (request, reply) => {
      const customer = await requireCustomer(db, request, reply);
      if (!customer) return;

      const cart = await openCartFor(db, customer.id);
      await clearDiscount(db, cart);
      return loadCart(db, { ...cart, discountCode: null });
    },
  );
}
