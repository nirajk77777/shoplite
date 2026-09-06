import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../app";
import { emptyCart, openCartFor } from "../carts/cart-store";
import { customers } from "../db/schema";
import { seed, trafficCustomer } from "../db/seed";
import { planTraffic, sendTraffic, type TrafficPlan, trafficRequestSchema } from "../demo/traffic";
import { parseBody } from "../http/body";

/** Any card the mock gateway approves: the burst is about the empty cart, not the card. */
const TRAFFIC_CARD = { number: "4242424242424242", expMonth: 12, expYear: 2030 };

/**
 * The rehearsal prop behind the portal's Demo panel. `POST /demo/simulate-traffic` sends
 * empty-cart checkouts at ShopLite itself for a configurable duration, which the checkout
 * route does not survive today: its error ratio climbs where Prometheus can see it, and the
 * Incident Resolver's Sentinel opens a Ticket about the route by itself.
 *
 * It answers as soon as the burst is shaped and sends it in the background, so the panel's
 * button returns at once and the traffic arrives while the Reviewer is watching the queue.
 */
export async function demoRoutes(app: FastifyInstance, { db }: AppDeps): Promise<void> {
  // One burst at a time. A second click while one is in flight is a mistake, not a request
  // for twice the traffic, and stacking them would make the error ratio meaningless.
  let running: AbortController | undefined;

  app.addHook("onClose", async () => {
    running?.abort();
  });

  /**
   * Puts ShopLite back to its seed: five customers, eight products, three discount codes, and
   * no carts, orders or payments. The Incident Resolver's `pnpm demo:reset` calls this as its
   * first step, since ShopLite's seed data lives here and nowhere else.
   */
  app.post("/demo/reset", async (_request, reply) => {
    running?.abort();
    await seed(db);
    return reply.send({ reseeded: true });
  });

  app.post("/demo/simulate-traffic", async (request, reply) => {
    const body = await parseBody(trafficRequestSchema, request.body ?? {}, reply);
    if (!body) return;
    // Claimed before the first await, so two clicks arriving together cannot both get past
    // the check and send twice the traffic. Every path out from here releases it.
    if (running) {
      return reply.code(409).send({ error: "Traffic is already being simulated" });
    }
    const controller = new AbortController();
    running = controller;

    try {
      const customerId = body.customerId ?? trafficCustomer.id;
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      if (!customer) {
        running = undefined;
        return reply.code(404).send({ error: "Customer not found" });
      }

      // Every checkout in the burst has to be an empty-cart checkout, so the cart is emptied
      // first rather than assumed empty: a rehearsal that left something in it would send
      // paid orders instead of the spike.
      await emptyCart(db, await openCartFor(db, customer.id));

      const plan = planTraffic(body);
      const origin = `${request.protocol}://${request.host}`;
      void run(plan, customer.id, origin, controller).finally(() => {
        if (running === controller) running = undefined;
      });

      return reply.code(202).send({ customerId: customer.id, ...plan });
    } catch (error) {
      if (running === controller) running = undefined;
      throw error;
    }
  });

  async function run(
    plan: TrafficPlan,
    customerId: string,
    origin: string,
    controller: AbortController,
  ): Promise<void> {
    const url = `${origin}/customers/${customerId}/checkout`;
    const result = await sendTraffic(plan, {
      // Real requests rather than `inject`, so the burst goes through the same HTTP server
      // instrumentation as a customer's own checkout and lands on the same route metric.
      send: async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ card: TRAFFIC_CARD }),
          signal: controller.signal,
        });
        // The body is read and dropped so the connection is released; a 500 is the point.
        await response.arrayBuffer();
      },
      wait: (ms) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            controller.signal.removeEventListener("abort", stop);
            resolve();
          }, ms);
          // Removed on the way out: a burst waits once per request, and a listener left
          // behind each time would be a hundred of them on one signal.
          function stop() {
            clearTimeout(timer);
            resolve();
          }
          controller.signal.addEventListener("abort", stop, { once: true });
        }),
      signal: controller.signal,
    });
    app.log.info({ customerId, ...plan, ...result }, "simulated traffic finished");
  }
}
