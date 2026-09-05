import { loadConfig } from "../src/config";
import { createDb } from "../src/db/client";
import { seed } from "../src/db/seed";

const db = createDb(loadConfig().databaseUrl);
try {
  await seed(db);
  console.log("Seeded customers, products, and discount codes");
} finally {
  await db.$client.end();
}
