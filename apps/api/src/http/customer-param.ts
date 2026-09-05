import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client";
import { customers } from "../db/schema";

export type CustomerParams = { customerId: string };

export type Customer = typeof customers.$inferSelect;

/**
 * Resolves the `:customerId` path parameter to a customer row, or sends a 404
 * and returns undefined. There is no authentication: the storefront's
 * "signed in as" picker decides which customer is acting.
 */
export async function requireCustomer(
  db: Db,
  request: FastifyRequest<{ Params: CustomerParams }>,
  reply: FastifyReply,
): Promise<Customer | undefined> {
  const id = request.params.customerId;
  const customer = z.uuid().safeParse(id).success
    ? (await db.select().from(customers).where(eq(customers.id, id)))[0]
    : undefined;
  if (!customer) {
    await reply.code(404).send({ error: "Customer not found" });
    return undefined;
  }
  return customer;
}
