import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDemoModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("infra_agent");

const SYSTEM_PROMPT = `You are the Infrastructure Agent in an AI-native SDLC pipeline.

You receive architecture decisions and project config, then plan and generate
infrastructure-as-code.

## Platform Routing:
- iOS + AWS: API Gateway + Lambda, S3, DynamoDB/RDS, CloudFront, Cognito
- iOS + Azure: Azure Functions, Cosmos DB, Azure CDN, Azure AD B2C
- iOS + GCP: Cloud Functions, Firestore, Cloud CDN (natural fit with Firebase)
- Web (vercel-supabase): Supabase PostgreSQL + Auth + Storage + Edge Functions, Vercel hosting
- Both: Shared Supabase backend with platform-specific frontends

## Responsibilities:
1. Select the infrastructure pattern (serverless API vs container)
2. Generate Pulumi IaC code (TypeScript) or Supabase schema definitions
3. Define environment stacks (dev/staging/prod)
4. Generate GitHub Actions CI/CD workflow for infra
5. Document endpoints and secrets inventory

## Output
Respond with a JSON block in \`\`\`json fences:
{
  "infraState": {
    "provider": "aws" | "azure" | "gcp" | "vercel-supabase" | "none",
    "stackName": "dev",
    "endpoints": { "api": "...", "cdn": "..." },
    "status": "planned"
  }
}

Also include the generated IaC code and CI/CD workflow as markdown code blocks.`;

export async function infraAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Architecture decisions: ${JSON.stringify(state.architectureDecisions, null, 2)}`;

  log.info("Starting infrastructure planning");
  const start = Date.now();

  const tools = await getToolsForAgent("infra_agent");
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

  let infraState = state.infraState;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.infraState) {
        infraState = parsed.infraState;
        log.info({ provider: parsed.infraState.provider, stack: parsed.infraState.stackName }, "Parsed infra state");
      }
    } catch {
      log.warn("Failed to parse infraState JSON from response");
    }
  }

  log.info({ elapsed }, "Completed infrastructure planning");

  return {
    messages: [new AIMessage({ content, name: "infra_agent" })],
    currentPhase: "infrastructure",
    infraState,
  };
}
