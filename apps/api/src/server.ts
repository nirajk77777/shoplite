import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { createMockGateway } from "./payments/mock-gateway";

const config = loadConfig();
const db = createDb(config.databaseUrl);
const app = buildApp({ db, gateway: createMockGateway(), logLevel: config.logLevel });

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
