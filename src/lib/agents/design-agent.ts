import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getSonnetModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("design_agent");

const SYSTEM_PROMPT = `You are the Design Agent in an AI-native SDLC pipeline.

You receive project requirements, configuration, and architecture decisions, then
produce a design system and screen inventory.

## Responsibilities:
1. Create a DESIGN.md with color tokens, typography scale, spacing system
2. Define each screen with layout descriptions suitable for Google Stitch
3. Identify animations that should use Lottie (loading states, transitions, micro-interactions)
4. Generate a component inventory

## Platform Awareness:
- iOS: Design for iPhone/iPad, follow Apple HIG, use SF Symbols
- Web: Design for responsive breakpoints, use shadcn/ui component patterns
- Both: Design a shared design system with platform-specific adaptations

## Output
Respond with a JSON block in \`\`\`json fences:
{
  "designAssets": {
    "screens": [
      { "name": "screen name", "stitchId": "", "status": "draft" }
    ],
    "lottieFiles": [
      { "name": "animation name", "url": "" }
    ],
    "designMdContent": "Full DESIGN.md content in markdown"
  }
}

Also include a human-readable summary of the design system and screen inventory.`;

export async function designAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Architecture decisions: ${JSON.stringify(state.architectureDecisions, null, 2)}`;

  log.info("Starting design generation");
  const start = Date.now();

  const tools = await getToolsForAgent("design_agent");
  log.info({ toolCount: tools.length }, "Loaded MCP tools");

  const response = await invokeWithTools(
    getSonnetModel(),
    [
      new SystemMessage(SYSTEM_PROMPT),
      ...state.messages,
      new HumanMessage(`[Context]\n${contextMessage}`),
    ],
    tools
  );

  const elapsed = Date.now() - start;

  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let designAssets = state.designAssets;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.designAssets) {
        designAssets = parsed.designAssets;
        log.info({ screens: parsed.designAssets.screens.length, animations: parsed.designAssets.lottieFiles.length }, "Parsed design assets");
      }
    } catch {
      log.warn("Failed to parse designAssets JSON from response");
    }
  }

  log.info({ elapsed }, "Completed design generation");

  return {
    messages: [new AIMessage({ content, name: "design_agent" })],
    currentPhase: "design",
    designAssets,
  };
}
