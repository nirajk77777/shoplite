import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema> & { $client: Pool };

/** Opens a connection pool. Close it with `db.$client.end()`. */
export function createDb(databaseUrl: string): Db {
  return drizzle({ client: new Pool({ connectionString: databaseUrl }), schema });
}
