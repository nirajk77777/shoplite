import fastifyProxy from "@fastify/http-proxy";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export type StorefrontOptions = {
  /** Absolute path of the storefront's built assets — what `pnpm --filter @shoplite/web build` writes. */
  webDistDir: string;
  /** Where the store's own routes are mounted, so a miss under it stays JSON instead of becoming HTML. */
  apiPrefix: string;
  /** Incident Resolver's portal API. Omitted and `/portal/*` is not served at all. */
  portalApiUrl?: string;
};

/** The one path the storefront reaches Incident Resolver on. Mirrors the dev server's proxy. */
const PORTAL_PREFIX = "/portal";

/**
 * Serves the built storefront from the same origin as the API, which is what the deployed
 * container is: one process behind one domain. It takes over the two jobs the Vite dev
 * server does locally — hand back `index.html` for a client-side route, and forward
 * `/portal/*` to Incident Resolver — so the storefront's relative URLs work unchanged in
 * both places and neither side needs CORS.
 */
export function serveStorefront(app: FastifyInstance, options: StorefrontOptions): void {
  const { webDistDir, apiPrefix, portalApiUrl } = options;

  // `wildcard: false` registers a route per built file rather than one catch-all, which
  // leaves every other URL to the not-found handler below — that is the SPA fallback.
  app.register(fastifyStatic, { root: webDistDir, wildcard: false });

  if (portalApiUrl) {
    app.register(fastifyProxy, {
      upstream: portalApiUrl,
      prefix: PORTAL_PREFIX,
      rewritePrefix: "",
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (isServiceCall(request.url, apiPrefix) || request.method !== "GET") {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.sendFile("index.html");
  });
}

/**
 * Whether a URL was meant for a service rather than for the storefront's router. A miss
 * here is a real 404 — answering it with `index.html` would hand a page to a `fetch` that
 * asked for JSON, and the caller would report a parse error instead of the 404 it got.
 */
function isServiceCall(url: string, apiPrefix: string): boolean {
  return [apiPrefix, PORTAL_PREFIX].some(
    (prefix) => prefix !== "" && (url === prefix || url.startsWith(`${prefix}/`)),
  );
}
