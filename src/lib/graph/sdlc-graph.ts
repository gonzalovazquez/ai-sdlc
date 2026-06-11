import { END, START, StateGraph } from "@langchain/langgraph";
import { SDLCState, type SDLCStateType } from "./state";
import {
  pmAgentNode,
  architectAgentNode,
  designAgentNode,
  infraAgentNode,
  codeAgentNode,
  qaAgentNode,
  releaseAgentNode,
  monitorAgentNode,
  humanReviewNode,
} from "../agents";
import { getCheckpointer, ensureCheckpointerReady } from "./checkpointer";
import { traced } from "../telemetry";

// ---------------------------------------------------------------------------
// Conditional routing functions
// ---------------------------------------------------------------------------

/**
 * After Architect: fork to Design + Infra (parallel) or Design only.
 * Web projects always route to infra (Supabase setup).
 * iOS projects only route to infra if hasBackend is true.
 */
function routeAfterArchitect(
  state: SDLCStateType
): string[] {
  const { platform, hasBackend } = state.projectConfig;

  if (platform === "web" || platform === "both") {
    // Web projects always have infra via Supabase
    return ["design_agent", "infra_agent"];
  }

  // iOS: only fork to infra if backend is needed
  if (hasBackend) {
    return ["design_agent", "infra_agent"];
  }

  return ["design_agent"];
}

/**
 * After QA: pass to release if approved, loop back to code if not.
 */
function routeAfterQA(state: SDLCStateType): string {
  if (state.qaResults?.approved) {
    return "release_agent";
  }
  return "code_agent"; // loop back for fixes
}

// ---------------------------------------------------------------------------
// Graph construction
// ---------------------------------------------------------------------------

function buildGraph() {
  const graph = new StateGraph(SDLCState)
    // ---- Agent nodes (traced → one OTel span per node execution) ----
    .addNode("pm_agent", traced("pm_agent", pmAgentNode))
    .addNode("architect_agent", traced("architect_agent", architectAgentNode))
    .addNode("design_agent", traced("design_agent", designAgentNode))
    .addNode("infra_agent", traced("infra_agent", infraAgentNode))
    .addNode("code_agent", traced("code_agent", codeAgentNode))
    .addNode("qa_agent", traced("qa_agent", qaAgentNode))
    .addNode("release_agent", traced("release_agent", releaseAgentNode))
    .addNode("monitor_agent", traced("monitor_agent", monitorAgentNode))
    .addNode("human_review", traced("human_review", humanReviewNode))

    // ---- Edges ----
    // Entry: user message → PM agent
    .addEdge(START, "pm_agent")

    // PM → Architect (sequential)
    .addEdge("pm_agent", "architect_agent")

    // Architect → parallel fork (Design + optionally Infra)
    .addConditionalEdges("architect_agent", routeAfterArchitect)

    // Both Design and Infra converge at human review
    .addEdge("design_agent", "human_review")
    .addEdge("infra_agent", "human_review")

    // After human approval → Code generation
    .addEdge("human_review", "code_agent")

    // Code → QA
    .addEdge("code_agent", "qa_agent")

    // QA → conditional: pass → Release, fail → back to Code
    .addConditionalEdges("qa_agent", routeAfterQA)

    // Release → Monitor
    .addEdge("release_agent", "monitor_agent")

    // Monitor → END (or feedback into next iteration)
    .addEdge("monitor_agent", END);

  return graph;
}

// ---------------------------------------------------------------------------
// Compiled graph singleton
// ---------------------------------------------------------------------------

let _compiledGraph: ReturnType<ReturnType<typeof buildGraph>["compile"]> | null =
  null;

/**
 * Returns the compiled SDLC graph. Lazily built on first call.
 * Call `ensureGraphReady()` once at server startup to guarantee the
 * Postgres checkpoint tables exist before any graph execution.
 */
export function getSDLCGraph() {
  if (!_compiledGraph) {
    const graph = buildGraph();
    const checkpointer = getCheckpointer();

    _compiledGraph = graph.compile({
      checkpointer,
      interruptBefore: ["human_review"],
    });
  }
  return _compiledGraph;
}

/**
 * Await this once at startup to ensure Postgres tables are created.
 */
export async function ensureGraphReady(): Promise<void> {
  getSDLCGraph(); // trigger lazy build
  await ensureCheckpointerReady();
}

export { buildGraph, routeAfterArchitect, routeAfterQA };
