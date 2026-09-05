import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./client";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Applies every pending migration in `apps/api/drizzle`. The migrations journal
 * lives in the `shoplite` schema so it never collides with the incident-resolver
 * repository's own migrations in the same database.
 */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, {
    migrationsFolder,
    migrationsSchema: "shoplite",
    migrationsTable: "__drizzle_migrations",
  });
}
