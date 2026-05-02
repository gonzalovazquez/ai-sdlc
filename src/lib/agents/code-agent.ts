import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getOpusModel } from "../llm";
import { agentLogger } from "../logger";
import { getToolsForAgent } from "../mcp/tools";
import { getLocalToolsForAgent } from "../local-tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("code_agent");

const SYSTEM_PROMPT = `You are the Code Agent in an AI-native SDLC pipeline.

You receive architecture decisions, design assets, and (optionally) infrastructure
state, then generate implementation code.

## Platform Routing:
### iOS (platform === "ios"):
- Generate .swift files with SwiftUI views and ViewModels
- Follow the architecture pattern (MVVM or TCA) from architectureDecisions
- Use NavigationStack for navigation
- Integrate Lottie animations from designAssets.lottieFiles
- Use conventional commits: feat:, fix:, refactor:, docs:, chore:
- Follow the DESIGN.md color tokens and component inventory

### Web (platform === "web"):
- Generate .tsx files with React Server/Client Components
- Use Next.js App Router conventions (page.tsx, layout.tsx, loading.tsx)
- Style with Tailwind CSS v4 + shadcn/ui components
- Use Framer Motion for animations
- Integrate Supabase client for data fetching and auth

### Both:
- Generate platform-specific frontends from shared API contracts
- Ensure consistent data models

## Tool Usage & Output
IMPORTANT: You MUST use your local file system tools to write all generated code directly to the local disk.
After writing to disk, you must use your github tools to create a branch and commit the new files.

Respond with a JSON block in \`\`\`json fences, but DO NOT output all file contents in the json block, only the paths:
{
  "codeArtifacts": {
    "files": [
      { "path": "src/...", "content": "File was written to disk." }
    ],
    "prUrl": null,
    "branch": "feat/feature-name"
  }
}

Also include a human-readable explanation of what was generated, why, and confirm files were written.`;

export async function codeAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Architecture decisions: ${JSON.stringify(state.architectureDecisions, null, 2)}
Design assets summary: ${JSON.stringify(
    state.designAssets
      ? {
          screenCount: state.designAssets.screens.length,
          screens: state.designAssets.screens.map((s) => s.name),
          animations: state.designAssets.lottieFiles.map((l) => l.name),
        }
      : null,
    null,
    2
  )}
Infra state: ${JSON.stringify(state.infraState, null, 2)}
QA feedback (if any): ${JSON.stringify(state.qaResults, null, 2)}`;

  log.info({ platform: state.projectConfig.platform }, "Starting code generation");
  const start = Date.now();

  const mcpTools = await getToolsForAgent("code_agent");
  const localTools = getLocalToolsForAgent("code_agent");
  const tools = [...mcpTools, ...localTools];
  log.info({ toolCount: tools.length }, "Loaded MCP and local tools");

  const response = await invokeWithTools(
    getOpusModel(),
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

  let codeArtifacts = state.codeArtifacts;

  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.codeArtifacts) {
        codeArtifacts = parsed.codeArtifacts;
        log.info({ fileCount: parsed.codeArtifacts.files.length, branch: parsed.codeArtifacts.branch }, "Generated code artifacts");
      }
    } catch {
      log.warn("Failed to parse codeArtifacts JSON from response");
    }
  }

  log.info({ elapsed }, "Completed code generation");

  return {
    messages: [new AIMessage({ content, name: "code_agent" })],
    currentPhase: "implementation",
    codeArtifacts,
  };
}
