import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { createMockGateway } from "./payments/mock-gateway";

const config = loadConfig();
const db = createDb(config.databaseUrl);
// With WEB_DIST_DIR set this process is the whole storefront, so the store's routes move
// under /api to leave the root for the pages. Without it, it is the API alone at the root
// and the Vite dev server serves the pages next to it.
const app = buildApp({
  db,
  gateway: createMockGateway(),
  logLevel: config.logLevel,
  apiPrefix: config.webDistDir ? "/api" : "",
  webDistDir: config.webDistDir,
  portalApiUrl: config.portalApiUrl,
});

app.addHook("onClose", async () => {
  await db.$client.end();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close();
  });
}

await app.listen({ port: config.port, host: config.host });
