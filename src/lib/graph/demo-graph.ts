import { END, START, StateGraph } from "@langchain/langgraph";
import { SDLCState, type SDLCStateType } from "./state";
import { pmAgentNode, architectAgentNode, codeAgentNode, humanReviewNode, scaffoldNode } from "../agents";
import { getCheckpointer, ensureCheckpointerReady } from "./checkpointer";

// Simplified linear demo flow: PM → Architect → Human Review → Scaffold → Code → END
// Scaffold runs after the review gate so rejected plans never trigger it.

function buildDemoGraph() {
  const graph = new StateGraph(SDLCState)
    .addNode("pm_agent", pmAgentNode)
    .addNode("architect_agent", architectAgentNode)
    .addNode("human_review", humanReviewNode)
    .addNode("scaffold", scaffoldNode)
    .addNode("code_agent", codeAgentNode)

    .addEdge(START, "pm_agent")
    .addEdge("pm_agent", "architect_agent")
    .addEdge("architect_agent", "human_review")
    .addEdge("human_review", "scaffold")
    .addEdge("scaffold", "code_agent")
    .addEdge("code_agent", END);

  return graph;
}

let _compiledDemoGraph: ReturnType<ReturnType<typeof buildDemoGraph>["compile"]> | null = null;

export function getDemoGraph() {
  if (!_compiledDemoGraph) {
    const graph = buildDemoGraph();
    const checkpointer = getCheckpointer();
    _compiledDemoGraph = graph.compile({
      checkpointer,
      // Pause AFTER human_review so the node runs and sets awaitingApproval,
      // which the stream route relays to the UI as the approval gate.
      interruptAfter: ["human_review"],
    });
  }
  return _compiledDemoGraph;
}

export async function ensureDemoGraphReady(): Promise<void> {
  getDemoGraph();
  await ensureCheckpointerReady();
}

export { buildDemoGraph };
