import { getDemoGraph, ensureDemoGraphReady } from "./demo-graph";
import { getSDLCGraph, ensureGraphReady } from "./sdlc-graph";

export type FlowMode = "simplified" | "full";

// Runtime override set from the UI. Kept on globalThis so all route bundles
// in the Next.js dev server see the same value.
const globalState = globalThis as typeof globalThis & {
  __flowModeOverride?: FlowMode;
};

export function setFlowMode(mode: FlowMode): void {
  globalState.__flowModeOverride = mode;
}

export function getFlowMode(): FlowMode {
  if (globalState.__flowModeOverride) {
    return globalState.__flowModeOverride;
  }
  return process.env.FLOW_MODE === "full" ? "full" : "simplified";
}

/**
 * The graph for the currently selected flow:
 * - "simplified" (default) — PM → Architect → Human Review → Scaffold → Code
 * - "full" — all eight agents with parallel Design/Infra fork and QA loop
 *
 * Both graphs share SDLCState and the human_review interrupt, but checkpoints
 * are not interchangeable: a thread should finish on the flow it started on.
 */
export function getActiveGraph() {
  return getFlowMode() === "full" ? getSDLCGraph() : getDemoGraph();
}

export async function ensureActiveGraphReady(): Promise<void> {
  if (getFlowMode() === "full") await ensureGraphReady();
  else await ensureDemoGraphReady();
}

/**
 * The node a rejected human review is attributed to (updateState asNode), so
 * the graph re-runs the right section on resume:
 * - simplified: pm_agent → re-runs architect_agent
 * - full: architect_agent → re-runs the Design/Infra fork
 */
export function getRejectionResumeNode(): "pm_agent" | "architect_agent" {
  return getFlowMode() === "full" ? "architect_agent" : "pm_agent";
}
