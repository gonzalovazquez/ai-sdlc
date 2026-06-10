import { END, START, StateGraph } from "@langchain/langgraph";
import { SDLCState, type SDLCStateType } from "./state";
import { pmAgentNode, architectAgentNode, codeAgentNode, humanReviewNode } from "../agents";
import { getCheckpointer, ensureCheckpointerReady } from "./checkpointer";

// Simplified linear demo flow: PM → Architect → Human Review → Code → END

function buildDemoGraph() {
  const graph = new StateGraph(SDLCState)
    .addNode("pm_agent", pmAgentNode)
    .addNode("architect_agent", architectAgentNode)
    .addNode("human_review", humanReviewNode)
    .addNode("code_agent", codeAgentNode)

    .addEdge(START, "pm_agent")
    .addEdge("pm_agent", "architect_agent")
    .addEdge("architect_agent", "human_review")
    .addEdge("human_review", "code_agent")
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
      interruptBefore: ["human_review"],
    });
  }
  return _compiledDemoGraph;
}

export async function ensureDemoGraphReady(): Promise<void> {
  getDemoGraph();
  await ensureCheckpointerReady();
}

export { buildDemoGraph };
