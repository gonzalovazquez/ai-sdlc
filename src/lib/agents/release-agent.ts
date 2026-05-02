import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getSonnetModel } from "../llm";
import { agentLogger } from "../logger";
import { getLocalToolsForAgent } from "../local-tools";
import { invokeWithTools } from "./invoke-with-tools";
import type { SDLCStateType } from "../graph/state";

const log = agentLogger("release_agent");

const SYSTEM_PROMPT = `You are the Release Agent in an AI-native SDLC pipeline.

You receive approved code artifacts and orchestrate the release process.

## Platform Routing:
### iOS:
- Generate release checklist (version bump, archive, signing, TestFlight upload)
- Draft release notes from commit history
- Create git tag (e.g., v1.0.0)
- Describe GitHub Actions workflow for automated builds

### Web:
- Trigger Vercel production deployment (git push origin main)
- Run Supabase database migrations (supabase db push)
- Verify preview deployment before promoting to production
- Generate release notes

## Output
You must use your GitHub tools to open a Pull Request for the feature branch.

Respond with:
1. A confirm that the PR was opened successfully
2. A release checklist with step-by-step instructions
3. Draft release notes in markdown
4. Any CI/CD pipeline updates needed`;

export async function releaseAgentNode(
  state: SDLCStateType
): Promise<Partial<SDLCStateType>> {
  const contextMessage = `Project config: ${JSON.stringify(state.projectConfig, null, 2)}
Code artifacts: ${JSON.stringify(
    state.codeArtifacts
      ? {
          fileCount: state.codeArtifacts.files.length,
          branch: state.codeArtifacts.branch,
          prUrl: state.codeArtifacts.prUrl,
        }
      : null,
    null,
    2
  )}
QA results: ${JSON.stringify(state.qaResults, null, 2)}
Infra state: ${JSON.stringify(state.infraState, null, 2)}`;

  log.info({ branch: state.codeArtifacts?.branch }, "Starting release process");
  const start = Date.now();

  const localTools = getLocalToolsForAgent("release_agent");
  log.info({ toolCount: localTools.length }, "Loaded local tools");

  const response = await invokeWithTools(
    getSonnetModel(),
    [
      new SystemMessage(SYSTEM_PROMPT),
      ...state.messages,
      new HumanMessage(`[Context]\n${contextMessage}`),
    ],
    localTools
  );

  const elapsed = Date.now() - start;

  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  log.info({ elapsed }, "Completed release process");

  return {
    messages: [new AIMessage({ content, name: "release_agent" })],
    currentPhase: "release",
  };
}
