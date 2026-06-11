import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("monitor_agent");

const SYSTEM_PROMPT = `You are the Monitor Agent in an AI-native SDLC pipeline.

You activate after release and set up monitoring, observability, and feedback loops.

## Responsibilities:
1. Define Firebase Crashlytics integration steps (iOS) or Sentry setup (web/both)
2. Create an event tracking plan (key analytics events)
3. Set up alerting rules (crash-free rate threshold: 99.5%)
4. Define performance baselines and SLOs
5. Create the feedback loop: crashes → Linear tickets → fixes → deploy

## Platform Awareness:
- iOS: Firebase Crashlytics + Analytics, Sentry Cocoa SDK, Xcode Organizer
- Web: Vercel Analytics (Core Web Vitals), @sentry/nextjs, Supabase Dashboard
- Both: Unified Sentry project with platform-specific SDKs

## Output
Respond with:
1. Monitoring setup checklist
2. Event tracking plan (list of key events to track)
3. Alerting configuration
4. Post-release monitoring routine (48-hour checklist)
5. Feedback loop documentation (crash → ticket → fix flow)`;

export async function monitorAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Infra state: ${JSON.stringify(state.infraState, null, 2)}
Code artifacts: ${JSON.stringify(
    state.codeArtifacts
      ? { branch: state.codeArtifacts.branch, prUrl: state.codeArtifacts.prUrl }
      : null,
    null,
    2
  )}`;

  log.info("Starting monitoring setup");
  const start = Date.now();

  const tools = await getToolsForAgent("monitor_agent");
  log.info({ toolCount: tools.length }, "Loaded MCP tools");

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

  log.info({ elapsed }, "Completed monitoring setup");

  return {
    messages: [new AIMessage({ content, name: "monitor_agent" })],
    currentPhase: "monitoring",
  };
}
