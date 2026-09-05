import { trace } from "@opentelemetry/api";
import fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { Config } from "./config";
import type { Db } from "./db/client";
import type { PaymentGateway } from "./payments/mock-gateway";
import { cartRoutes } from "./routes/cart";
import { checkoutRoutes } from "./routes/checkout";
import { customerRoutes } from "./routes/customers";
import { productRoutes } from "./routes/products";

export type AppDeps = {
  db: Db;
  gateway: PaymentGateway;
  /** Pass a pino instance to capture logs; otherwise a default logger at `logLevel` is created. */
  loggerInstance?: FastifyBaseLogger;
  logLevel?: Config["logLevel"];
};

/** Builds the HTTP app without listening, so tests can drive it with `inject`. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = deps.loggerInstance
    ? fastify({ loggerInstance: deps.loggerInstance })
    : fastify({ logger: { level: deps.logLevel ?? "info" } });

  // Every response names its trace so the storefront and the portal can point at the
  // exact request that failed. Absent when the OpenTelemetry SDK is not loaded.
  app.addHook("onRequest", async (_request, reply) => {
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    if (traceId) reply.header("x-trace-id", traceId);
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(customerRoutes, deps);
  app.register(productRoutes, deps);
  app.register(cartRoutes, deps);
  app.register(checkoutRoutes, deps);

  return app;
}
