import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import type { Db } from "../db/client";
import { createMockGateway } from "../payments/mock-gateway";

const INDEX_HTML = "<!doctype html><title>ShopLite</title>";
const ASSET_JS = "console.log('storefront')";

/** None of these requests reach a route that queries, so the store's tables never open. */
const noDb = {} as Db;

describe("serving the storefront from the API process", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const webDistDir = await mkdtemp(join(tmpdir(), "shoplite-dist-"));
    await writeFile(join(webDistDir, "index.html"), INDEX_HTML);
    await mkdir(join(webDistDir, "assets"));
    await writeFile(join(webDistDir, "assets", "app.js"), ASSET_JS);

    app = buildApp({
      db: noDb,
      gateway: createMockGateway(),
      logLevel: "fatal",
      apiPrefix: "/api",
      webDistDir,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves a built asset as itself", async () => {
    const response = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(ASSET_JS);
  });

  it("answers a client-side route with index.html so the storefront's router can take it", async () => {
    for (const url of ["/", "/checkout", "/tickets"]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(200);
      expect(response.body, url).toBe(INDEX_HTML);
    }
  });

  it("keeps a miss under the API prefix a JSON 404 rather than a page", async () => {
    const response = await app.inject({ method: "GET", url: "/api/no-such-route" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
  });

  it("keeps a miss under /portal a JSON 404 when no portal is configured", async () => {
    const response = await app.inject({ method: "GET", url: "/portal/tickets" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
  });

  it("does not answer a non-GET miss with a page", async () => {
    const response = await app.inject({ method: "POST", url: "/anything" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found" });
  });

  it("leaves the health check at the root, above the storefront", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
