import { AIMessage } from "@langchain/core/messages";
import type { SDLCStateType } from "../graph/state";

/**
 * Human Review Gate — interrupts the graph for human-in-the-loop approval.
 *
 * When this node executes, it sets `awaitingApproval: true` and the graph
 * pauses (via LangGraph's interrupt mechanism). The user reviews the design
 * and architecture outputs, then resumes the graph via the /api/agent/approve
 * endpoint.
 */
export async function humanReviewNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  // Build a summary of what's ready for review
  const designSummary = state.designAssets
    ? `**Design Assets:**\n- ${state.designAssets.screens.length} screens defined\n- ${state.designAssets.lottieFiles.length} animations\n`
    : "Design: not yet available\n";

  const archSummary = state.architectureDecisions
    ? `**Architecture:**\n- Pattern: ${state.architectureDecisions.uiPattern}\n- Data Layer: ${state.architectureDecisions.dataLayer}\n- Navigation: ${state.architectureDecisions.navigation}\n`
    : "Architecture: not yet available\n";

  const infraSummary = state.infraState
    ? `**Infrastructure:**\n- Provider: ${state.infraState.provider}\n- Stack: ${state.infraState.stackName}\n- Status: ${state.infraState.status}\n`
    : "";

  const reviewMessage = `## Human Review Required

The following artifacts are ready for your review before code generation begins:

${archSummary}
${designSummary}
${infraSummary}

Please review and approve to continue, or provide feedback to revise.`;

  return {
    messages: [new AIMessage({ content: reviewMessage, name: "human_review" })],
    currentPhase: "review",
    awaitingApproval: true,
  };
}
