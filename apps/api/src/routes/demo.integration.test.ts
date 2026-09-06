import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { loadCart, openCartFor } from "../carts/cart-store";
import { loadConfig } from "../config";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { orders } from "../db/schema";
import { seed, trafficCustomer } from "../db/seed";
import { createMockGateway } from "../payments/mock-gateway";

// Needs the incident-resolver compose stack. Run with `pnpm test:integration`.
//
// The burst is sent over real HTTP against the app's own port, so this test listens for
// real rather than driving the app with `inject`: that is the whole point of the route.

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("POST /demo/simulate-traffic", () => {
  const db = createDb(loadConfig().databaseUrl);
  let app: FastifyInstance;
  let origin: string;

  beforeAll(async () => {
    await runMigrations(db);
    app = buildApp({ db, gateway: createMockGateway(), logLevel: "fatal" });
    origin = await app.listen({ port: 0, host: "127.0.0.1" });
  });

  beforeEach(async () => {
    await seed(db);
  });

  afterAll(async () => {
    await app.close();
    await db.$client.end();
  });

  const simulate = (body: Record<string, unknown>) =>
    fetch(`${origin}/demo/simulate-traffic`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("shapes the burst, answers at once, and sends it in the background", async () => {
    const response = await simulate({ durationMs: 1_000, intervalMs: 100 });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      customerId: trafficCustomer.id,
      durationMs: 1_000,
      intervalMs: 100,
      requests: 10,
    });

    // A second burst on top of the first would make the route's error ratio meaningless.
    expect((await simulate({ durationMs: 1_000, intervalMs: 100 })).status).toBe(409);

    await settle(1_800);

    // Every checkout in the burst was against an empty cart, so none of them bought anything.
    const bought = await db.select().from(orders).where(eq(orders.customerId, trafficCustomer.id));
    expect(bought).toEqual([]);
    const cart = await loadCart(db, await openCartFor(db, trafficCustomer.id));
    expect(cart.items).toEqual([]);

    // And the burst is over, so the panel can send another one. This one is a single
    // request, so it is finished before the next test asks for a burst of its own.
    expect((await simulate({ durationMs: 1_000, intervalMs: 1_000 })).status).toBe(202);
    await settle(300);
  });

  it("refuses a customer it does not know", async () => {
    const response = await simulate({ customerId: "00000000-0000-4000-8000-00000000ffff" });

    expect(response.status).toBe(404);
  });
});
