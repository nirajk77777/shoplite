import { z } from "zod";

/**
 * The demo's traffic generator. It exists so a rehearsal can put a route into a
 * measurable error spike on demand: every checkout it sends is against an empty
 * cart, which ShopLite does not survive today, so Prometheus sees the checkout
 * route's error ratio climb and the Incident Resolver's Sentinel acts on it.
 *
 * Shaping and sending are separate so the shape can be tested without a clock.
 */

/** How long a burst may run, and how tightly it may be packed. */
export const trafficRequestSchema = z.object({
  durationMs: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  intervalMs: z.coerce.number().int().min(50).max(10_000).default(250),
  /** Whose cart the checkouts are sent against. Defaults to the demo traffic customer. */
  customerId: z.uuid().optional(),
});

export type TrafficRequest = z.infer<typeof trafficRequestSchema>;

export type TrafficPlan = {
  durationMs: number;
  intervalMs: number;
  requests: number;
};

/** How many checkouts a burst of this shape sends, and how far apart. */
export function planTraffic(input: { durationMs: number; intervalMs: number }): TrafficPlan {
  return {
    durationMs: input.durationMs,
    intervalMs: input.intervalMs,
    requests: Math.max(1, Math.floor(input.durationMs / input.intervalMs)),
  };
}

export type TrafficResult = {
  /** Requests attempted, whatever the server answered. A 500 is the point of the burst. */
  sent: number;
  /** Requests that never reached the server, so they are not on the route's error rate. */
  failed: number;
};

export type TrafficDeps = {
  /** Sends one checkout. Its number, from 1, is only for logging. */
  send(request: number): Promise<void>;
  wait(ms: number): Promise<void>;
  /** Aborted when the server is shutting down, or when a second burst supersedes this one. */
  signal?: AbortSignal;
};

/**
 * Sends the plan, one request every `intervalMs`, and resolves when the last one is
 * done. A request the network refused is counted and the burst carries on: the burst
 * is a demo prop, and one refused connection is not a reason to stop making traffic.
 */
export async function sendTraffic(
  plan: TrafficPlan,
  { send, wait, signal }: TrafficDeps,
): Promise<TrafficResult> {
  let sent = 0;
  let failed = 0;
  for (let request = 1; request <= plan.requests; request += 1) {
    if (signal?.aborted) break;
    if (request > 1) await wait(plan.intervalMs);
    if (signal?.aborted) break;
    sent += 1;
    try {
      await send(request);
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
