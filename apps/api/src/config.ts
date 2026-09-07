import { z } from "zod";

/**
 * ShopLite has no compose file of its own. It connects to the Postgres and the
 * OTLP collector that the incident-resolver repository's docker compose runs,
 * and reads both locations from the environment.
 *
 * Two settings decide whether this process is the API alone or the whole storefront.
 * Locally the Vite dev server serves the HTML and proxies to this API, so both are
 * unset. In the deployed container there is no Vite, so `WEB_DIST_DIR` points at the
 * built storefront and `PORTAL_API_URL` takes over the proxying Vite was doing.
 */
const configSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgres://postgres:postgres@localhost:5432/incident_resolver"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().default("http://localhost:4318"),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    WEB_DIST_DIR: z.string().min(1).optional(),
    PORTAL_API_URL: z.url().optional(),
  })
  .transform((env) => ({
    databaseUrl: env.DATABASE_URL,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    webDistDir: env.WEB_DIST_DIR,
    portalApiUrl: env.PORTAL_API_URL,
  }));

export type Config = z.output<typeof configSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

type Env = Record<string, string | undefined>;

function withoutBlanks(env: Env): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== "") cleaned[key] = value;
  }
  return cleaned;
}

export function loadConfig(env: Env = process.env): Config {
  const parsed = configSchema.safeParse(withoutBlanks(env));
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid configuration: ${problems}`);
  }
  return parsed.data;
}
