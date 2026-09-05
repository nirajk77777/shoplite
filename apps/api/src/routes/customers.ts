import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app";
import { customers } from "../db/schema";

export async function customerRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  app.get("/customers", async () => {
    return db
      .select({ id: customers.id, email: customers.email, name: customers.name })
      .from(customers)
      .orderBy(customers.name);
  });
}
