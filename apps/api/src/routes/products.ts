import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app";
import { products } from "../db/schema";

export async function productRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  app.get("/products", async () => {
    return db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        priceCents: products.priceCents,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .orderBy(products.name);
  });
}
