import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { seed, seedCustomers, seedProducts } from "../db/seed";

// Needs the incident-resolver compose stack (Postgres and Grafana LGTM).
// Starts the API the way `pnpm start` does, with the OpenTelemetry SDK loaded
// through `--import`, then checks that one declined checkout can be found in
// Tempo, Loki, and Prometheus.

const config = loadConfig();
const lokiUrl = process.env.LOKI_URL ?? "http://localhost:3100";
const tempoUrl = process.env.TEMPO_URL ?? "http://localhost:3200";
const prometheusUrl = process.env.PROMETHEUS_URL ?? "http://localhost:9090";

const port = 4900 + Math.floor(Math.random() * 90);
const api = `http://127.0.0.1:${port}`;
const instanceId = randomUUID();
const apiDir = fileURLToPath(new URL("../..", import.meta.url));

const ava = seedCustomers[0];
const mug = seedProducts[0];
const declinedCard = { number: "4000000000000002", expMonth: 12, expYear: 2030 };

async function pollUntil<T>(
  what: string,
  attempt: () => Promise<T | undefined>,
  timeoutMs = 25_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await attempt();
      if (result !== undefined) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const detail = lastError ? ` (last error: ${String(lastError)})` : "";
  throw new Error(`Timed out waiting for ${what}${detail}`);
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${api}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The single sample of an instant Prometheus query, or undefined when there is no series yet. */
async function promSample(query: string): Promise<number | undefined> {
  const url = new URL(`${prometheusUrl}/api/v1/query`);
  url.searchParams.set("query", query);
  const body = (await (await fetch(url)).json()) as {
    data: { result: Array<{ value: [number, string] }> };
  };
  const sample = body.data.result[0]?.value[1];
  return sample === undefined ? undefined : Number(sample);
}

type TempoSpan = {
  name: string;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string } }>;
};

type TempoTrace = { batches: Array<{ scopeSpans: Array<{ spans: TempoSpan[] }> }> };

function spansOf(trace: TempoTrace): TempoSpan[] {
  return trace.batches.flatMap((batch) => batch.scopeSpans.flatMap((scope) => scope.spans));
}

function attribute(span: TempoSpan, key: string): string | undefined {
  const value = span.attributes?.find((entry) => entry.key === key)?.value;
  return value?.stringValue ?? value?.intValue;
}

describe("ShopLite telemetry", () => {
  const db = createDb(config.databaseUrl);
  let server: ChildProcess;
  let serverOutput = "";

  beforeAll(async () => {
    await runMigrations(db);
    await seed(db);

    server = spawn(
      "pnpm",
      ["exec", "tsx", "--import", "./src/telemetry/instrumentation.ts", "src/server.ts"],
      {
        cwd: apiDir,
        env: {
          ...process.env,
          PORT: String(port),
          LOG_LEVEL: "info",
          OTEL_SERVICE_NAME: "shoplite-api",
          OTEL_RESOURCE_ATTRIBUTES: `service.instance.id=${instanceId}`,
          // Flush quickly so the test does not wait on the default batching delays.
          OTEL_BSP_SCHEDULE_DELAY: "500",
          OTEL_BLRP_SCHEDULE_DELAY: "500",
          OTEL_METRIC_EXPORT_INTERVAL: "1000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    server.stdout?.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    server.stderr?.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });

    await pollUntil(`API on ${api}\n${serverOutput}`, async () =>
      (await fetch(`${api}/health`)).ok ? true : undefined,
    );
  }, 60_000);

  afterAll(async () => {
    server?.kill("SIGTERM");
    await new Promise((resolve) => server?.once("exit", resolve));
    await db.$client.end();
  });

  it("returns the trace id of every request in a response header", async () => {
    const response = await fetch(`${api}/products`);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-trace-id")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("makes a declined checkout findable in Tempo, Loki, and Prometheus by its trace id", async () => {
    await post(`/customers/${ava.id}/cart/items`, { productId: mug.id });
    await post(`/customers/${ava.id}/cart/discount`, { code: "SALE10" });
    const checkout = await post(`/customers/${ava.id}/checkout`, { card: declinedCard });
    expect(checkout.status).toBe(402);
    const traceId = checkout.headers.get("x-trace-id");
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);

    // Tempo: the trace exists, its server span carries the route and the 402.
    const spans = await pollUntil("trace in Tempo", async () => {
      const response = await fetch(`${tempoUrl}/api/traces/${traceId}`);
      return response.ok ? spansOf((await response.json()) as TempoTrace) : undefined;
    });
    const serverSpan = spans.find((span) => attribute(span, "http.route") !== undefined);
    expect(serverSpan).toBeDefined();
    expect(serverSpan?.name).toBe("POST /customers/:customerId/checkout");
    expect(serverSpan && attribute(serverSpan, "http.route")).toBe(
      "/customers/:customerId/checkout",
    );
    expect(serverSpan && attribute(serverSpan, "http.response.status_code")).toBe("402");

    // Loki: the decline log line carries the same trace id, and the reason is in the
    // line itself and in the structured fields pino attached.
    const query = `{service_name="shoplite-api"} | trace_id="${traceId}"`;
    const streams = await pollUntil("log line in Loki", async () => {
      const url = new URL(`${lokiUrl}/loki/api/v1/query_range`);
      url.searchParams.set("query", query);
      url.searchParams.set("since", "10m");
      const body = (await (await fetch(url)).json()) as {
        data: {
          result: Array<{ stream: Record<string, string>; values: Array<[string, string]> }>;
        };
      };
      return body.data.result.length > 0 ? body.data.result : undefined;
    });
    const lines = streams.flatMap((stream) => stream.values.map(([, line]) => line));
    expect(lines).toContain("payment declined by gateway: insufficient_funds");
    expect(streams.map((stream) => stream.stream.declineCode)).toContain("insufficient_funds");
    expect(JSON.stringify(streams)).not.toContain(declinedCard.number);

    // Prometheus: the checkout error counter for this process shows one decline.
    const errors = await pollUntil("checkout_errors_total in Prometheus", () =>
      promSample(`checkout_errors_total{instance="${instanceId}",reason="declined"}`),
    );
    expect(errors).toBe(1);

    const attempts = await pollUntil("checkout_total in Prometheus", () =>
      promSample(`checkout_total{instance="${instanceId}"}`),
    );
    expect(attempts).toBe(1);

    const discounts = await pollUntil("discount_applied_total in Prometheus", () =>
      promSample(`discount_applied_total{instance="${instanceId}",code="SALE10"}`),
    );
    expect(discounts).toBe(1);
  });
});
