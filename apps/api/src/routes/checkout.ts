import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app";
import { checkout } from "../checkout/checkout";
import { orders } from "../db/schema";
import { parseBody } from "../http/body";
import { type CustomerParams, requireCustomer } from "../http/customer-param";

const checkoutBody = z.object({
  card: z.object({
    number: z.string().trim().min(1).max(32),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(2024).max(2100),
  }),
});

export async function checkoutRoutes(
  app: FastifyInstance,
  { db, gateway }: AppDeps,
): Promise<void> {
  app.post<{ Params: CustomerParams }>(
    "/customers/:customerId/checkout",
    async (request, reply) => {
      const customer = await requireCustomer(db, request, reply);
      if (!customer) return;
      const body = await parseBody(checkoutBody, request.body, reply);
      if (!body) return;

      const result = await checkout(db, gateway, request.log, {
        customerId: customer.id,
        card: body.card,
      });
      switch (result.status) {
        case "empty_cart":
          return reply.code(400).send({ error: "Cart is empty" });
        case "declined":
          // The gateway's reason is on the payment row and in the logs, not in the response.
          return reply.code(402).send({ error: "Checkout failed" });
        case "paid":
          return reply.code(201).send({ order: result.order });
      }
    },
  );

  app.get<{ Params: CustomerParams }>("/customers/:customerId/orders", async (request, reply) => {
    const customer = await requireCustomer(db, request, reply);
    if (!customer) return;
    return db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customer.id))
      .orderBy(desc(orders.createdAt));
  });
}
