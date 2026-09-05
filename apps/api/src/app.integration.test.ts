import { Writable } from "node:stream";
import type { FastifyInstance } from "fastify";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { seed, seedCustomers, seedProducts } from "./db/seed";
import { createMockGateway } from "./payments/mock-gateway";

// Needs the incident-resolver compose stack. Run with `pnpm test:integration`.

const ava = seedCustomers[0];
const liam = seedCustomers[1];
const mug = seedProducts[0]; // 1200
const poster = seedProducts[1]; // 2599

const approvedCard = { number: "4242424242424242", expMonth: 12, expYear: 2030 };
const declinedCard = { number: "4000000000000002", expMonth: 12, expYear: 2030 };

describe("ShopLite API", () => {
  const db = createDb(loadConfig().databaseUrl);
  const logLines: string[] = [];
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations(db);
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        logLines.push(chunk.toString());
        callback();
      },
    });
    app = buildApp({
      db,
      gateway: createMockGateway(),
      loggerInstance: pino({ level: "warn" }, sink),
    });
    await app.ready();
  });

  beforeEach(async () => {
    await seed(db);
    logLines.length = 0;
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  const cartPath = `/customers/${ava.id}/cart`;

  async function addToCart(productId: string, quantity = 1) {
    return app.inject({
      method: "POST",
      url: `${cartPath}/items`,
      payload: { productId, quantity },
    });
  }

  it("lists the seeded customers so a storefront can offer a signed-in-as picker", async () => {
    const response = await app.inject({ method: "GET", url: "/customers" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toContainEqual({ id: ava.id, email: ava.email, name: ava.name });
  });

  it("lists the catalog with prices in cents", async () => {
    const response = await app.inject({ method: "GET", url: "/products" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toContainEqual(
      expect.objectContaining({ sku: "MUG-01", priceCents: 1200 }),
    );
  });

  it("starts every customer with an empty open cart", async () => {
    const response = await app.inject({ method: "GET", url: cartPath });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [],
      discountCode: null,
      totals: { itemCount: 0, subtotalCents: 0, discountCents: 0, totalCents: 0 },
    });
  });

  it("adds items and shows the running totals", async () => {
    await addToCart(mug.id, 2);
    const response = await addToCart(poster.id);

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([
      expect.objectContaining({ productId: mug.id, name: "Stoneware Mug", quantity: 2 }),
      expect.objectContaining({ productId: poster.id, quantity: 1 }),
    ]);
    expect(response.json().totals).toEqual({
      itemCount: 3,
      subtotalCents: 4999,
      discountCents: 0,
      totalCents: 4999,
    });
  });

  it("applies a discount code to the cart", async () => {
    await addToCart(mug.id, 2);
    await addToCart(poster.id);
    const response = await app.inject({
      method: "POST",
      url: `${cartPath}/discount`,
      payload: { code: "SALE10" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().discountCode).toBe("SALE10");
    expect(response.json().totals).toEqual({
      itemCount: 3,
      subtotalCents: 4999,
      discountCents: 500,
      totalCents: 4499,
    });
  });

  it("rejects an unknown or inactive discount code", async () => {
    await addToCart(mug.id);

    const unknown = await app.inject({
      method: "POST",
      url: `${cartPath}/discount`,
      payload: { code: "NOPE" },
    });
    const inactive = await app.inject({
      method: "POST",
      url: `${cartPath}/discount`,
      payload: { code: "EXPIRED20" },
    });

    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toEqual({ error: "Discount code is not valid" });
    expect(inactive.statusCode).toBe(400);
  });

  it("removes an item from the cart", async () => {
    await addToCart(mug.id, 2);
    await addToCart(poster.id);
    const response = await app.inject({
      method: "DELETE",
      url: `${cartPath}/items/${poster.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([expect.objectContaining({ productId: mug.id })]);
  });

  it("checks out end to end: items, discount, payment, and an order the customer can see", async () => {
    await addToCart(mug.id, 2);
    await addToCart(poster.id);
    await app.inject({ method: "POST", url: `${cartPath}/discount`, payload: { code: "SALE10" } });

    const checkout = await app.inject({
      method: "POST",
      url: `/customers/${ava.id}/checkout`,
      payload: { card: approvedCard },
    });

    expect(checkout.statusCode).toBe(201);
    const order = checkout.json().order;
    expect(order).toMatchObject({ status: "paid", discountCode: "SALE10" });
    expect(order.totalCents).toBeLessThan(order.subtotalCents);

    const orders = await app.inject({ method: "GET", url: `/customers/${ava.id}/orders` });
    expect(orders.json()).toEqual([expect.objectContaining({ id: order.id, status: "paid" })]);

    const cart = await app.inject({ method: "GET", url: cartPath });
    expect(cart.json().items).toEqual([]);
  });

  it("hides the decline reason from the client but logs it", async () => {
    await addToCart(mug.id);

    const checkout = await app.inject({
      method: "POST",
      url: `/customers/${ava.id}/checkout`,
      payload: { card: declinedCard },
    });

    expect(checkout.statusCode).toBe(402);
    expect(checkout.json()).toEqual({ error: "Checkout failed" });

    const orders = await app.inject({ method: "GET", url: `/customers/${ava.id}/orders` });
    expect(orders.json()).toEqual([]);

    const declineLog = logLines.map((line) => JSON.parse(line)).find((entry) => entry.declineCode);
    expect(declineLog).toMatchObject({
      msg: "payment declined by gateway",
      declineCode: "insufficient_funds",
      cardLast4: "0002",
    });
    expect(JSON.stringify(declineLog)).not.toContain(declinedCard.number);
  });

  it("refuses to check out an empty cart", async () => {
    const checkout = await app.inject({
      method: "POST",
      url: `/customers/${liam.id}/checkout`,
      payload: { card: approvedCard },
    });

    expect(checkout.statusCode).toBe(400);
    expect(checkout.json()).toEqual({ error: "Cart is empty" });
  });

  it("returns 404 for a customer that does not exist", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/customers/00000000-0000-4000-8000-00000000ffff/cart",
    });

    expect(response.statusCode).toBe(404);
  });
});
