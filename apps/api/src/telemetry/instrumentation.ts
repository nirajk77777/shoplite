import { register } from "node:module";
import { FastifyOtelInstrumentation } from "@fastify/otel";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { loadConfig } from "../config";

/**
 * OpenTelemetry setup. Loaded before the application with
 * `tsx --import ./src/telemetry/instrumentation.ts src/server.ts`, so the
 * module hook below is in place before fastify, pg, and pino are imported.
 *
 * Traces, metrics, and logs all go over OTLP HTTP to the collector in the
 * incident-resolver compose stack (Grafana LGTM), which fans them out to
 * Tempo, Prometheus, and Loki. pino log lines are bridged through the OTel
 * logs API by the pino instrumentation, which also stamps trace_id and
 * span_id on every line so Loki can be queried by trace id.
 */

// The app is ESM. Auto-instrumentation patches modules as they load, which for
// ESM needs Node's module hook rather than the CommonJS require hook.
register("@opentelemetry/instrumentation/hook.mjs", import.meta.url);

// Emit the stable HTTP semantic conventions (http.server.request.duration, http.route,
// http.response.status_code) so the Grafana dashboard has one set of names to query.
process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= "http";

const { otlpEndpoint } = loadConfig();

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "shoplite-api",
  traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` }),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 10_000),
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` }),
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Keep http, pg, pino, and undici. The rest only add noise for this service.
      "@opentelemetry/instrumentation-dns": { enabled: false },
      "@opentelemetry/instrumentation-express": { enabled: false },
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-net": { enabled: false },
    }),
    new FastifyOtelInstrumentation({
      registerOnInitialization: true,
      ignorePaths: (options) => options.url === "/health",
    }),
  ],
});

sdk.start();

for (const exitSignal of ["SIGINT", "SIGTERM"] as const) {
  process.once(exitSignal, () => {
    void sdk.shutdown();
  });
}
