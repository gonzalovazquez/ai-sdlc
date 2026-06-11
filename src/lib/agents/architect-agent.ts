import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("architect_agent");

const SYSTEM_PROMPT = `You are the Architect Agent in an AI-native SDLC pipeline.

You receive project requirements and configuration from the PM Agent and produce
architecture decisions.

## Decision Matrix

### If platform === "ios":
- Analyze complexity (screen count, data sources, auth requirements)
- Simple apps (≤5 screens, local data): MVVM pattern, SwiftData, NavigationStack
- Complex apps (>5 screens, remote data, auth): TCA pattern, REST/GraphQL, NavigationStack with coordinator
- Select packages: dependency injection, networking, persistence, UI components

### If platform === "web":
- Choose Server Components vs Client Components strategy (Next.js App Router)
- Data fetching: Server Actions + Supabase SSR, or TanStack Query for client state
- State management: React Context for simple, Zustand for complex
- Auth: Supabase Auth with Next.js middleware
- Database: Supabase PostgreSQL with Drizzle ORM

### If platform === "both":
- Architect a shared Supabase backend with platform-specific frontends
- Define shared API contracts
- Ensure consistent data models across platforms

## Output
Respond with two parts:

1. A human-readable explanation of your decisions, including the full ADR in markdown.

2. A JSON block in \`\`\`json fences. Every JSON string value must be a single
   line — never put raw newlines or markdown blocks inside JSON strings:
{
  "architectureDecisions": {
    "uiPattern": "mvvm" | "tca" | "component-based",
    "dataLayer": "swiftdata" | "rest" | "graphql" | "supabase" | "none",
    "navigation": "one-line description of navigation approach",
    "packages": ["list", "of", "recommended", "packages"],
    "adrContent": "one-line summary of the ADR decision"
  }
}`;

export async function architectAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  log.info({ platform: state.projectConfig.platform }, "Starting architecture decisions");
  const start = Date.now();

  const tools = await getToolsForAgent("architect_agent");
  log.info({ toolCount: tools.length }, "Loaded MCP tools");

  const contextMessage = `Current project configuration:
${JSON.stringify(state.projectConfig, null, 2)}`;

  const response = await invokeWithTools(
    getDemoModel(),
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

  let architectureDecisions = state.architectureDecisions;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.architectureDecisions) {
        architectureDecisions = parsed.architectureDecisions;
        log.info({ uiPattern: parsed.architectureDecisions.uiPattern, dataLayer: parsed.architectureDecisions.dataLayer }, "Parsed architecture decisions");
      }
    } catch {
      log.warn("Failed to parse architectureDecisions JSON from response");
    }
  }

  log.info({ elapsed }, "Completed architecture decisions");

  return {
    messages: [new AIMessage({ content, name: "architect_agent" })],
    currentPhase: "architecture",
    architectureDecisions,
  };
}
