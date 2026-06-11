import { registerOTel } from "@vercel/otel";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { logs } from "@opentelemetry/api-logs";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";

// Local dev default: the grafana/otel-lgtm container from docker-compose.
// Docker sets the endpoint explicitly; on Vercel the var must stay unset so
// @vercel/otel falls back to the platform's own collector.
if (process.env.NODE_ENV !== "production") {
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??= "http://localhost:4318";
}
process.env.OTEL_SERVICE_NAME ??= "sdlc-ai";

// Traces: NodeSDK with an OTLP exporter wired from the env vars above.
registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME });

// Logs: ship pino records over OTLP (→ Loki in otel-lgtm). Only wired when
// an endpoint is configured — without it, pino still gets trace_id/span_id
// injected but logs stay on stdout only.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  logs.setGlobalLoggerProvider(
    new LoggerProvider({
      // The default resource doesn't reliably pick up OTEL_SERVICE_NAME
      // here, so service.name is set explicitly to match the trace side.
      resource: defaultResource().merge(
        resourceFromAttributes({ "service.name": process.env.OTEL_SERVICE_NAME })
      ),
      processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
    })
  );
}

// Patches pino so every log record carries trace_id/span_id of the active
// span and is bridged to the OTel logs pipeline. Must run before any module
// imports pino, which the instrumentation hook guarantees.
registerInstrumentations({
  instrumentations: [new PinoInstrumentation()],
});
