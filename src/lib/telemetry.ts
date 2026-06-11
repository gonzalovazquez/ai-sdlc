import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { SDLCStateType } from "./graph/state";

const tracer = trace.getTracer("sdlc-graph");

type AgentNode = (
  state: SDLCStateType,
  config?: LangGraphRunnableConfig
) => Promise<Partial<SDLCStateType>>;

/**
 * Wraps a graph node in an OpenTelemetry span named `agent.<name>`, so a
 * full graph run renders as one trace whose waterfall mirrors the graph
 * (parallel Design/Infra fork, QA→Code retry loop). Pino logs emitted
 * inside the node carry this span's trace_id via the pino instrumentation.
 *
 * With no OTel SDK registered (tests, builds) the @opentelemetry/api
 * tracer is a no-op, so wrapped nodes behave identically.
 */
export function traced(name: string, fn: AgentNode): AgentNode {
  return (state, config) =>
    tracer.startActiveSpan(`agent.${name}`, async (span) => {
      const threadId = config?.configurable?.thread_id;
      span.setAttributes({
        "sdlc.agent": name,
        "sdlc.phase": state.currentPhase,
        "sdlc.project.platform": state.projectConfig.platform,
        ...(threadId !== undefined && { "sdlc.thread_id": String(threadId) }),
      });

      try {
        const update = await fn(state, config);

        if (update.currentPhase) {
          span.setAttribute("sdlc.phase.next", update.currentPhase);
        }
        if (update.qaResults) {
          span.setAttribute("sdlc.qa.approved", update.qaResults.approved);
          span.setAttribute("sdlc.qa.tests_failed", update.qaResults.testsFailed);
        }
        span.setStatus({ code: SpanStatusCode.OK });
        return update;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    });
}
