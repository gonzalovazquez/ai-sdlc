import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getOllamaModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("pm_agent");

const SYSTEM_PROMPT = `You are the PM Agent in an AI-native SDLC pipeline.

Your responsibilities:
1. Gather project requirements from the user's description
2. Extract structured project configuration: name, description, platform (ios/web/both),
   cloud provider, whether it needs a backend, auth, screen count, and data sources
3. Create a structured breakdown of epics and user stories
4. Write clear acceptance criteria

You output a JSON block with the projectConfig and a summary of requirements.
Always ask clarifying questions if the description is ambiguous.

When you have enough information, respond with a JSON block wrapped in \`\`\`json fences:
{
  "projectConfig": {
    "name": "...",
    "description": "...",
    "platform": "ios" | "web" | "both",
    "cloudProvider": "aws" | "azure" | "gcp" | "vercel-supabase" | "none",
    "hasBackend": true/false,
    "hasAuth": true/false,
    "screenCount": number,
    "dataSources": ["..."]
  },
  "requirements": "markdown summary of requirements, epics, stories"
}`;

export async function pmAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  log.info("Starting requirements extraction");
  const start = Date.now();

  const tools = await getToolsForAgent("pm_agent");
  log.info({ toolCount: tools.length }, "Loaded MCP tools");

  const response = await invokeWithTools(
    getOllamaModel(),
    [new SystemMessage(SYSTEM_PROMPT), ...state.messages],
    tools
  );

  const elapsed = Date.now() - start;

  // Try to parse projectConfig from the response
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  let projectConfig = state.projectConfig;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.projectConfig) {
        projectConfig = parsed.projectConfig;
        log.info({ project: projectConfig.name, platform: projectConfig.platform }, "Parsed project config");
      }
    } catch {
      log.warn("Failed to parse projectConfig JSON from response");
    }
  }

  log.info({ elapsed }, "Completed requirements extraction");

  return {
    messages: [new AIMessage({ content, name: "pm_agent" })],
    currentPhase: "requirements",
    projectConfig,
  };
}
