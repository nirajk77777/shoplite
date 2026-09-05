import { defineConfig } from "drizzle-kit";
import { loadConfig } from "./src/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: loadConfig().databaseUrl },
  migrations: { schema: "shoplite", table: "__drizzle_migrations" },
  strict: true,
  verbose: true,
});
