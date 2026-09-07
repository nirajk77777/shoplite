import { trace } from "@opentelemetry/api";
import fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { Config } from "./config";
import type { Db } from "./db/client";
import type { PaymentGateway } from "./payments/mock-gateway";
import { cartRoutes } from "./routes/cart";
import { checkoutRoutes } from "./routes/checkout";
import { customerRoutes } from "./routes/customers";
import { demoRoutes } from "./routes/demo";
import { productRoutes } from "./routes/products";
import { serveStorefront } from "./web/storefront";

export type AppDeps = {
  db: Db;
  gateway: PaymentGateway;
  /** Pass a pino instance to capture logs; otherwise a default logger at `logLevel` is created. */
  loggerInstance?: FastifyBaseLogger;
  logLevel?: Config["logLevel"];
  /**
   * Where the store's own routes are mounted. Empty — the default, and what tests use —
   * puts them at the root. The deployed container passes `/api`, because there the
   * storefront is served from this same origin and calls the store on that path.
   */
  apiPrefix?: string;
  /** Serve the built storefront from here too. Omitted and this process is the API alone. */
  webDistDir?: string;
  /** Where `/portal/*` is forwarded. Only read when `webDistDir` is set. */
  portalApiUrl?: string;
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

  // Stays at the root under every configuration: it answers for the process, not the store.
  app.get("/health", async () => ({ status: "ok" }));

  const apiPrefix = deps.apiPrefix ?? "";
  const routeOptions = { ...deps, prefix: apiPrefix };
  app.register(customerRoutes, routeOptions);
  app.register(productRoutes, routeOptions);
  app.register(cartRoutes, routeOptions);
  app.register(checkoutRoutes, routeOptions);
  app.register(demoRoutes, routeOptions);

  if (deps.webDistDir) {
    serveStorefront(app, {
      webDistDir: deps.webDistDir,
      apiPrefix,
      portalApiUrl: deps.portalApiUrl,
    });
  }

  return app;
}
